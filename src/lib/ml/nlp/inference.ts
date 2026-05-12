import type {
  DataType,
  FeatureExtractionPipeline,
  ZeroShotClassificationPipeline,
} from "@huggingface/transformers";
import { ModelRegistry, pipeline } from "@huggingface/transformers";
import type {
  Aggregation,
  DashboardSpec,
  FilterSpec,
  SchemaField,
  VisType,
} from "@/lib/ml/types";
import {
  buildFieldSemanticText,
  chooseTitle,
  dedupeFilters,
  exactSampleMatch,
  exactSamplePredicateMatches,
  extractPromptPhrases,
  type FieldRole,
  type FilterValue,
  fieldNameMentionScore,
  inferAggregationHeuristic,
  inferLimit,
  inferSortHeuristic,
  normalizeText,
  promptExplicitlyGroupsByField,
  representativeSampleValues,
  rolePrior,
} from "./heuristics";

export type InferenceBackend = "webgpu" | "wasm";

export type RankedField = {
  field: SchemaField;
  score: number;
  semanticScore: number;
  nameScore: number;
  sampleScore: number;
  priorScore: number;
  matchedSample?: FilterValue;
};

const embeddingCache = new Map<string, number[]>();

const preferredDtypes: DataType[] = ["q8", "q4", "fp32"];

export function dot(a: number[], b: number[]) {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += a[i] * b[i];
  return total;
}

export async function embedTexts(texts: string[]) {
  const keys = texts.map(normalizeText);
  const missing = Array.from(
    new Set(keys.filter((key) => key && !embeddingCache.has(key))),
  );

  if (missing.length) {
    const embedder = await InferenceEngine.getEmbedder();
    const tensor = await embedder(missing, {
      pooling: "mean",
      normalize: true,
    });

    const dims = tensor.dims as number[];
    const width = dims[dims.length - 1];
    const data = Array.from(tensor.data as Float32Array);

    for (let i = 0; i < missing.length; i++) {
      embeddingCache.set(missing[i], data.slice(i * width, (i + 1) * width));
    }
  }

  return keys.map((key) => {
    const vec = embeddingCache.get(key);
    if (!vec) throw new Error(`Missing embedding for "${key}"`);
    return vec;
  });
}

export async function chooseAggregation(
  prompt: string,
  metric?: string,
): Promise<Aggregation> {
  const heuristic = inferAggregationHeuristic(prompt);
  if (heuristic) return heuristic;

  const zeroShot = await InferenceEngine.getZeroShot();
  const result = await zeroShot(
    `Pick the best aggregation for this analytics request.
Request: ${prompt}
Metric: ${metric ?? "unknown"}`,
    ["sum", "average", "count", "minimum", "maximum"],
  );

  const top = result.labels[0] as string;
  const map: Record<string, Aggregation> = {
    sum: "sum",
    average: "avg",
    count: "count",
    minimum: "min",
    maximum: "max",
  };

  return map[top] ?? "sum";
}

export async function rankFieldsByPrompt(
  prompt: string,
  fields: SchemaField[],
  role: FieldRole,
): Promise<RankedField[]> {
  if (!fields.length) return [];

  const semanticTexts = fields.map((field) =>
    buildFieldSemanticText(field, role),
  );
  const vectors = await embedTexts([prompt, ...semanticTexts]);
  const [promptVec, ...fieldVecs] = vectors;

  return fields
    .map((field, i) => {
      const semanticScore = dot(promptVec, fieldVecs[i]);
      const nameScore = fieldNameMentionScore(prompt, field);
      const matchedSample = exactSampleMatch(prompt, field);
      const sampleScore =
        matchedSample === undefined ? 0 : role === "filter" ? 0.5 : 0.22;
      const priorScore = rolePrior(field, role);

      return {
        field,
        score: semanticScore + nameScore + sampleScore + priorScore,
        semanticScore,
        nameScore,
        sampleScore,
        priorScore,
        matchedSample,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export async function inferSemanticSampleMatch(
  prompt: string,
  field: SchemaField,
): Promise<{ rawValue: FilterValue; score: number } | null> {
  const exact = exactSampleMatch(prompt, field);
  if (exact !== undefined) return { rawValue: exact, score: 1.1 };

  const values = representativeSampleValues(field, 20);
  if (!values.length) return null;

  const phrases = extractPromptPhrases(prompt);
  const valueTexts = values.map((value) => String(value));
  const vectors = await embedTexts([...phrases, ...valueTexts]);

  const phraseVecs = vectors.slice(0, phrases.length);
  const valueVecs = vectors.slice(phrases.length);

  let bestIndex = -1;
  let bestScore = -1;

  for (let i = 0; i < values.length; i++) {
    const valueText = normalizeText(String(values[i]));
    if (!valueText) continue;

    for (let j = 0; j < phrases.length; j++) {
      const phrase = phrases[j];
      if (phrase.length < 3) continue;

      let score = dot(phraseVecs[j], valueVecs[i]);

      if (valueText.includes(phrase) || phrase.includes(valueText)) {
        score += 0.08;
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
  }

  if (bestIndex === -1 || bestScore < 0.62) return null;

  return {
    rawValue: values[bestIndex],
    score: bestScore,
  };
}

export async function inferFilters(
  prompt: string,
  schema: SchemaField[],
): Promise<FilterSpec[]> {
  const filterable = schema.filter(
    (field) => field.kind === "string" || field.kind === "date",
  );

  const explicitGroupByFieldNames = new Set(
    filterable
      .filter((field) => promptExplicitlyGroupsByField(prompt, field))
      .map((field) => field.name),
  );

  const ranked = await rankFieldsByPrompt(prompt, filterable, "filter");
  const topFields = ranked.slice(0, 8);

  const matches = (
    await Promise.all(
      topFields.map(async (rankedField) => {
        const exactPredicates = exactSamplePredicateMatches(
          prompt,
          rankedField.field,
        );

        if (exactPredicates.length) {
          return exactPredicates
            .filter((predicate) => {
              const fieldIsAlreadyGrouped = explicitGroupByFieldNames.has(
                rankedField.field.name,
              );

              return !(fieldIsAlreadyGrouped && predicate.op === "=");
            })
            .map((predicate) => {
              return {
                score: rankedField.score + predicate.score,
                filter: {
                  field: rankedField.field.name,
                  op: predicate.op,
                  value: predicate.value,
                },
              };
            });
        }

        if (explicitGroupByFieldNames.has(rankedField.field.name)) {
          return [];
        }

        const semanticMatch = await inferSemanticSampleMatch(
          prompt,
          rankedField.field,
        );

        if (!semanticMatch) return [];

        const totalScore = rankedField.score + semanticMatch.score;
        if (totalScore < 1.15) return [];

        return [
          {
            score: totalScore,
            filter: {
              field: rankedField.field.name,
              op: "=" as const,
              value: semanticMatch.rawValue,
            },
          },
        ];
      }),
    )
  ).flat();

  return dedupeFilters(
    matches.sort((a, b) => b.score - a.score).map((match) => match.filter),
  ).slice(0, 4);
}

export async function chooseSort(prompt: string) {
  const heuristic = inferSortHeuristic(prompt);
  if (heuristic) return heuristic;

  const zeroShot = await InferenceEngine.getZeroShot();
  const result = await zeroShot(
    `Should the result be sorted ascending, descending, or left unspecified?
Request: ${prompt}`,
    ["descending", "ascending", "unspecified"],
  );

  const top = result.labels[0] as string;
  if (top === "descending") return { direction: "desc" as const };
  if (top === "ascending") return { direction: "asc" as const };
  return undefined;
}

export async function chooseChartType(
  prompt: string,
): Promise<{ label: VisType; score: number }> {
  const zeroShot = await InferenceEngine.getZeroShot();
  const labelMapping: Record<string, VisType> = {
    "bar chart": "bar",
    "line chart": "line",
    "area chart": "area",
    "scatter plot": "scatter",
    "pie chart": "pie",
    "sunburst chart": "pie",
    table: "table",
    datagrid: "table",
    "kpi card": "kpi",
  };

  const result = await zeroShot(prompt, Object.keys(labelMapping));
  const top = {
    label: result.labels[0] as string,
    score: result.scores[0] as number,
  };

  return {
    label: labelMapping[top.label] ?? "table",
    score: top.score,
  };
}

export async function parsePrompt(
  prompt: string,
  schema: SchemaField[],
): Promise<DashboardSpec> {
  const numeric = schema.filter((field) => field.kind === "number");
  const groupable = schema.filter(
    (field) => field.kind === "string" || field.kind === "date",
  );

  const [chartChoice, metricRanks, dimensionRanks, filters, sort] =
    await Promise.all([
      chooseChartType(prompt),
      rankFieldsByPrompt(prompt, numeric, "metric"),
      rankFieldsByPrompt(prompt, groupable, "dimension"),
      inferFilters(prompt, schema),
      chooseSort(prompt),
    ]);

  const metric = metricRanks[0]?.field?.name;
  const aggregation = await chooseAggregation(prompt, metric);

  const filteredFields = new Set(filters.map((filter) => filter.field));
  const dimension = dimensionRanks.find(({ field }) => {
    return (
      !filteredFields.has(field.name) ||
      promptExplicitlyGroupsByField(prompt, field)
    );
  })?.field.name;

  const warnings: string[] = [];

  if (!metric && chartChoice.label !== "table" && chartChoice.label !== "kpi") {
    warnings.push("I could not confidently identify a numeric measure.");
  }
  if (!dimension && chartChoice.label !== "kpi") {
    warnings.push("I could not confidently identify a grouping field.");
  }

  const sortField =
    chartChoice.label === "kpi" ? metric : (metric ?? dimension);

  const confidenceParts = [
    chartChoice.score ?? 0,
    metricRanks[0]?.score ?? 0,
    dimensionRanks[0]?.score ?? 0,
    filters.length ? 0.85 : 0.55,
  ];

  return {
    confidence:
      confidenceParts.reduce((sum, score) => sum + score, 0) /
      confidenceParts.length,
    warnings,
    views: [
      {
        kind:
          chartChoice.label === "table"
            ? "table"
            : chartChoice.label === "kpi"
              ? "kpi"
              : "chart",
        chartType: chartChoice.label,
        xField: dimension,
        yField: metric,
        aggregation,
        filters,
        limit: inferLimit(prompt),
        sort:
          sort && sortField
            ? { field: sortField, direction: sort.direction }
            : undefined,
        title: chooseTitle(prompt),
      },
    ],
  };
}

export const isPromptValid = async (prompt: string): Promise<boolean> => {
  const zeroShot = await InferenceEngine.getZeroShot();
  const result = await zeroShot(
    prompt,
    ["a data visualization, chart, table, or dashboard"],
    {
      hypothesis_template: "This request asks for {}.",
      multi_label: true,
    },
  );

  return result.scores[0] >= 0.7;
};

export async function preloadInference(
  progress_callback?: (x: unknown) => void,
) {
  await Promise.all([
    InferenceEngine.getZeroShot(progress_callback),
    InferenceEngine.getEmbedder(progress_callback),
  ]);
}

const detectBackend = async (): Promise<InferenceBackend> => {
  if (!("gpu" in self.navigator)) return "wasm";

  try {
    const adapter = await self.navigator.gpu.requestAdapter();
    if (!adapter) return "wasm";
    return "webgpu";
  } catch {
    return "wasm";
  }
};

const chooseDtype = async (
  model: string,
  backend: InferenceBackend,
): Promise<DataType> => {
  try {
    const available = await ModelRegistry.get_available_dtypes(model);
    return preferredDtypes.find((dtype) => available.includes(dtype)) ?? "fp32";
  } catch {
    return backend === "webgpu" ? "fp32" : "q8";
  }
};

const inferenceRuntimeConfig = async (
  model: string,
): Promise<{
  device: InferenceBackend;
  dtype: DataType;
}> => {
  const device = await detectBackend();
  const dtype = await chooseDtype(model, device);
  return { device, dtype };
};

export const InferenceEngine: {
  zeroShotPromise: Promise<ZeroShotClassificationPipeline> | null;
  embedderPromise: Promise<FeatureExtractionPipeline> | null;
  getZeroShot: (
    progress_callback?: (x: unknown) => void,
  ) => Promise<ZeroShotClassificationPipeline>;
  getEmbedder: (
    progress_callback?: (x: unknown) => void,
  ) => Promise<FeatureExtractionPipeline>;
} = {
  zeroShotPromise: null,
  embedderPromise: null,

  async getZeroShot(progress_callback?: (x: unknown) => void) {
    const model = "Xenova/nli-deberta-v3-xsmall";
    const { device, dtype } = await inferenceRuntimeConfig(model);

    if (!InferenceEngine.zeroShotPromise) {
      InferenceEngine.zeroShotPromise = pipeline(
        "zero-shot-classification",
        model,
        { progress_callback, device, dtype },
      );
    }
    return InferenceEngine.zeroShotPromise;
  },

  async getEmbedder(progress_callback?: (x: unknown) => void) {
    const model = "Xenova/all-MiniLM-L6-v2";
    const { device, dtype } = await inferenceRuntimeConfig(model);

    if (!InferenceEngine.embedderPromise) {
      InferenceEngine.embedderPromise = pipeline("feature-extraction", model, {
        progress_callback,
        device,
        dtype,
      });
    }
    return InferenceEngine.embedderPromise;
  },
};
