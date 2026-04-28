import type {
  DataType,
  FeatureExtractionPipeline,
  ZeroShotClassificationPipeline,
} from "@huggingface/transformers";
import { ModelRegistry, pipeline } from "@huggingface/transformers";
import { fieldToDescriptor } from "@/lib/ml/schema";
import type {
  Aggregation,
  DashboardSpec,
  FilterSpec,
  SchemaField,
  VisType,
} from "@/lib/ml/types";

type FilterValue = FilterSpec["value"];

type ParseRequest = {
  type: "parse";
  prompt: string;
  schema: SchemaField[];
};

type InitRequest = {
  type: "init";
};

type WorkerRequest = ParseRequest | InitRequest;

type InferenceBackend = "webgpu" | "wasm";
type FieldRole = "metric" | "dimension" | "filter";

type RankedField = {
  field: SchemaField;
  score: number;
  semanticScore: number;
  nameScore: number;
  sampleScore: number;
  priorScore: number;
  matchedSample?: FilterValue;
};

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "show",
  "me",
  "chart",
  "plot",
  "graph",
  "table",
  "dashboard",
  "please",
]);

const embeddingCache = new Map<string, number[]>();

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

const preferredDtypes: DataType[] = ["q8", "q4", "fp32"];

const chooseDtype = async (
  model: string,
  backend: InferenceBackend,
): Promise<DataType> => {
  try {
    const available = await ModelRegistry.get_available_dtypes(model);
    return preferredDtypes.find((x) => available.includes(x)) ?? "fp32";
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

const InferenceEngine: {
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

function normalizeText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dot(a: number[], b: number[]) {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += a[i] * b[i];
  return total;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenize(s: string) {
  return normalizeText(s).split(" ").filter(Boolean);
}

function hasWholePhrase(haystack: string, needle: string) {
  if (!needle) return false;
  return new RegExp(`(^|\\s)${escapeRegExp(needle)}($|\\s)`).test(haystack);
}

function uniqueByNormalized(values: FilterValue[]): FilterValue[] {
  const out: FilterValue[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const key = normalizeText(String(value));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }

  return out;
}

function representativeSampleValues(
  field: SchemaField,
  max = 12,
): FilterValue[] {
  return uniqueByNormalized(field.sampleValues ?? []).slice(0, max);
}

function rolePrior(field: SchemaField, role: FieldRole) {
  if (role === "metric") return field.kind === "number" ? 0.15 : -0.2;
  if (role === "dimension")
    return field.kind === "string" || field.kind === "date" ? 0.12 : -0.15;
  if (role === "filter")
    return field.kind === "string" || field.kind === "date" ? 0.08 : -0.1;
  return 0;
}

function fieldNameMentionScore(prompt: string, field: SchemaField) {
  const p = normalizeText(prompt);
  const names = Array.from(
    new Set([normalizeText(field.name), normalizeText(field.name)]),
  ).filter(Boolean);

  let best = 0;
  for (const name of names) {
    if (hasWholePhrase(p, name)) {
      best = Math.max(best, name.includes(" ") ? 0.35 : 0.2);
    }
  }

  return best;
}

function exactSampleMatch(
  prompt: string,
  field: SchemaField,
): FilterValue | undefined {
  const p = normalizeText(prompt);
  for (const rawValue of representativeSampleValues(field, 20)) {
    const value = normalizeText(String(rawValue));
    if (!value) continue;
    if (hasWholePhrase(p, value)) return rawValue;
  }
  return undefined;
}

function buildFieldSemanticText(field: SchemaField, role: FieldRole) {
  const samples = representativeSampleValues(field, 8)
    .map((x) => String(x))
    .join(", ");

  return [
    fieldToDescriptor(field),
    `role: ${role}`,
    samples ? `common values: ${samples}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}

async function embedTexts(texts: string[]) {
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

function extractPromptPhrases(prompt: string, maxN = 4, maxPhrases = 24) {
  const tokens = tokenize(prompt).filter(
    (t) => t.length > 1 && !STOPWORDS.has(t),
  );

  const phrases: string[] = [];
  const full = normalizeText(prompt);
  if (full) phrases.push(full);

  for (let n = Math.min(maxN, tokens.length); n >= 1; n--) {
    for (let i = 0; i <= tokens.length - n; i++) {
      const phrase = tokens.slice(i, i + n).join(" ");
      if (!phrase) continue;
      phrases.push(phrase);
      if (phrases.length >= maxPhrases) {
        return Array.from(new Set(phrases));
      }
    }
  }

  return Array.from(new Set(phrases));
}

async function rankFieldsByPrompt(
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

async function inferSemanticSampleMatch(
  prompt: string,
  field: SchemaField,
): Promise<{ rawValue: FilterValue; score: number } | null> {
  const exact = exactSampleMatch(prompt, field);
  if (exact !== undefined) return { rawValue: exact, score: 1.1 };

  const values = representativeSampleValues(field, 20);
  if (!values.length) return null;

  const phrases = extractPromptPhrases(prompt);
  const valueTexts = values.map((x) => String(x));
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

async function inferFilters(
  prompt: string,
  schema: SchemaField[],
): Promise<FilterSpec[]> {
  const filterable = schema.filter(
    (f) => f.kind === "string" || f.kind === "date",
  );

  const ranked = await rankFieldsByPrompt(prompt, filterable, "filter");
  const topFields = ranked.slice(0, 8);

  const matches = await Promise.all(
    topFields.map(async (rankedField) => {
      const semanticMatch =
        rankedField.matchedSample !== undefined
          ? { rawValue: rankedField.matchedSample, score: 1.1 }
          : await inferSemanticSampleMatch(prompt, rankedField.field);

      if (!semanticMatch) return null;

      const totalScore = rankedField.score + semanticMatch.score;
      if (totalScore < 1.15) return null;

      return {
        score: totalScore,
        filter: {
          field: rankedField.field.name,
          op: "=" as const,
          value: semanticMatch.rawValue,
        },
      };
    }),
  );

  return dedupeFilters(
    matches
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.filter),
  ).slice(0, 4);
}

function dedupeFilters(filters: FilterSpec[]) {
  const seen = new Set<string>();
  return filters.filter((f) => {
    const key = `${f.field}:${f.op}:${JSON.stringify(f.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferAggregationHeuristic(prompt: string): Aggregation | undefined {
  const p = normalizeText(prompt);
  if (/\baverage\b|\bavg\b|\bmean\b/.test(p)) return "avg";
  if (/\bcount\b|\bhow many\b|\bnumber of\b/.test(p)) return "count";
  if (/\bminimum\b|\bmin\b|\blowest\b/.test(p)) return "min";
  if (/\bmaximum\b|\bmax\b|\bhighest\b/.test(p)) return "max";
  if (/\bsum\b|\btotal\b/.test(p)) return "sum";
  return undefined;
}

async function chooseAggregation(
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

function inferLimit(prompt: string): number | undefined {
  const p = normalizeText(prompt);
  const topMatch = p.match(/\btop\s+(\d+)\b/);
  if (topMatch) return Number(topMatch[1]);

  const bottomMatch = p.match(/\bbottom\s+(\d+)\b/);
  if (bottomMatch) return Number(bottomMatch[1]);

  return undefined;
}

function inferSortHeuristic(prompt: string) {
  const p = normalizeText(prompt);

  if (/\bdescending\b|\bdesc\b|\bhighest\b|\blargest\b|\btop\b/.test(p)) {
    return { direction: "desc" as const };
  }
  if (/\bascending\b|\basc\b|\blowest\b|\bsmallest\b|\bbottom\b/.test(p)) {
    return { direction: "asc" as const };
  }
  return undefined;
}

async function chooseSort(prompt: string) {
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

async function chooseChartType(
  prompt: string,
): Promise<{ label: VisType; score: number }> {
  const zeroShot = await InferenceEngine.getZeroShot();
  const labels = [
    "bar chart",
    "line chart",
    "area chart",
    "scatter plot",
    "pie chart",
    "table",
    "kpi card",
  ];

  const result = await zeroShot(prompt, labels);
  const top = {
    label: result.labels[0] as string,
    score: result.scores[0] as number,
  };

  const map: Record<string, VisType> = {
    "bar chart": "bar",
    "line chart": "line",
    "area chart": "area",
    "scatter plot": "scatter",
    "pie chart": "pie",
    table: "table",
    "kpi card": "kpi",
  };

  return {
    label: map[top.label] ?? "table",
    score: top.score,
  };
}

function promptExplicitlyGroupsByField(prompt: string, field: SchemaField) {
  const p = normalizeText(prompt);
  const fieldName = normalizeText(field.name);
  return new RegExp(
    `\\b(by|per|across|over|grouped by|broken down by)\\s+${escapeRegExp(fieldName)}\\b`,
  ).test(p);
}

function chooseTitle(prompt: string) {
  return prompt.trim().replace(/\.$/, "");
}

async function parsePrompt(
  prompt: string,
  schema: SchemaField[],
): Promise<DashboardSpec> {
  const numeric = schema.filter((f) => f.kind === "number");
  const groupable = schema.filter(
    (f) => f.kind === "string" || f.kind === "date",
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

  const filteredFields = new Set(filters.map((f) => f.field));
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
      confidenceParts.reduce((sum, x) => sum + x, 0) / confidenceParts.length,
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

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  try {
    if (event.data.type === "init") {
      await Promise.all([
        InferenceEngine.getZeroShot((x) =>
          self.postMessage({ type: "progress", payload: x }),
        ),
        InferenceEngine.getEmbedder((x) =>
          self.postMessage({ type: "progress", payload: x }),
        ),
      ]);
      self.postMessage({ type: "ready" });
      return;
    }

    if (event.data.type === "parse") {
      const spec = await parsePrompt(event.data.prompt, event.data.schema);
      self.postMessage({ type: "result", payload: spec });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      payload: error instanceof Error ? error.message : "Unknown worker error",
    });
  }
});
