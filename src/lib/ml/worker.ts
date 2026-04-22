import type {
  FeatureExtractionPipeline,
  ZeroShotClassificationPipeline,
} from "@huggingface/transformers";
import { pipeline } from "@huggingface/transformers";
import { fieldToDescriptor } from "@/lib/ml/schema";
import type {
  Aggregation,
  ChartType,
  DashboardSpec,
  FilterSpec,
  SchemaContext,
  SchemaField,
} from "@/lib/ml/types";

type ParseRequest = {
  type: "parse";
  prompt: string;
  schema: SchemaContext;
};

type InitRequest = {
  type: "init";
};

type WorkerRequest = ParseRequest | InitRequest;

const ModelSingleton: {
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

  getZeroShot(progress_callback?: (x: unknown) => void) {
    if (!ModelSingleton.zeroShotPromise) {
      ModelSingleton.zeroShotPromise = pipeline(
        "zero-shot-classification",
        "Xenova/nli-deberta-v3-xsmall",
        { progress_callback, device: "webgpu" },
      );
    }
    return ModelSingleton.zeroShotPromise;
  },

  getEmbedder(progress_callback?: (x: unknown) => void) {
    if (!ModelSingleton.embedderPromise) {
      ModelSingleton.embedderPromise = pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        { progress_callback, device: "webgpu" },
      );
    }
    return ModelSingleton.embedderPromise;
  },
};

function normalizeText(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function dot(a: number[], b: number[]) {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += a[i] * b[i];
  return total;
}

async function embedTexts(texts: string[]) {
  const embedder = await ModelSingleton.getEmbedder();
  const tensor = await embedder(texts, {
    pooling: "mean",
    normalize: true,
  });

  const dims = tensor.dims as number[];
  const width = dims[dims.length - 1];
  const count = dims[0];
  const data = Array.from(tensor.data as Float32Array);

  return Array.from({ length: count }, (_, i) =>
    data.slice(i * width, (i + 1) * width),
  );
}

async function rankFieldsByPrompt(prompt: string, fields: SchemaField[]) {
  if (!fields.length) return [];

  const descriptors = fields.map(fieldToDescriptor);
  const vectors = await embedTexts([prompt, ...descriptors]);
  const [promptVec, ...fieldVecs] = vectors;

  return fields
    .map((field, i) => ({
      field,
      score: dot(promptVec, fieldVecs[i]),
    }))
    .sort((a, b) => b.score - a.score);
}

async function chooseChartType(
  prompt: string,
): Promise<{ label: ChartType; score: number }> {
  const zeroShot = await ModelSingleton.getZeroShot();
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

  const map: Record<string, ChartType> = {
    "bar chart": "bar",
    "line chart": "line",
    "area chart": "area",
    "scatter plot": "scatter",
    "pie chart": "pie",
    table: "table",
    "kpi card": "kpi",
  };

  return {
    label: map[top.label] ?? "bar",
    score: top.score,
  };
}

function inferAggregation(prompt: string): Aggregation {
  const p = normalizeText(prompt);
  if (/\baverage\b|\bavg\b|\bmean\b/.test(p)) return "avg";
  if (/\bcount\b|\bhow many\b|\bnumber of\b/.test(p)) return "count";
  if (/\bminimum\b|\bmin\b|\blowest\b/.test(p)) return "min";
  if (/\bmaximum\b|\bmax\b|\bhighest\b/.test(p)) return "max";
  return "sum";
}

function inferLimit(prompt: string): number | undefined {
  const p = normalizeText(prompt);
  const topMatch = p.match(/\btop\s+(\d+)\b/);
  if (topMatch) return Number(topMatch[1]);

  const bottomMatch = p.match(/\bbottom\s+(\d+)\b/);
  if (bottomMatch) return Number(bottomMatch[1]);

  return undefined;
}

function inferSort(prompt: string) {
  const p = normalizeText(prompt);

  if (/\bdescending\b|\bdesc\b|\bhighest\b|\blargest\b|\btop\b/.test(p)) {
    return { direction: "desc" as const };
  }
  if (/\bascending\b|\basc\b|\blowest\b|\bsmallest\b|\bbottom\b/.test(p)) {
    return { direction: "asc" as const };
  }
  return undefined;
}

function inferFilters(prompt: string, schema: SchemaContext): FilterSpec[] {
  const p = normalizeText(prompt);
  const filters: FilterSpec[] = [];

  for (const field of schema.fields) {
    for (const rawValue of field.sampleValues ?? []) {
      const value = normalizeText(String(rawValue));
      if (!value) continue;

      if (p.includes(value)) {
        filters.push({
          field: field.name,
          op: "=",
          value: rawValue,
        });
      }
    }
  }

  return dedupeFilters(filters);
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

function chooseTitle(prompt: string) {
  return prompt.trim().replace(/\.$/, "");
}

async function parsePrompt(
  prompt: string,
  schema: SchemaContext,
): Promise<DashboardSpec> {
  const numeric = schema.fields.filter((f) => f.kind === "number");
  const groupable = schema.fields.filter(
    (f) => f.kind === "string" || f.kind === "date",
  );

  const [chartChoice, metricRanks, dimensionRanks] = await Promise.all([
    chooseChartType(prompt),
    rankFieldsByPrompt(prompt, numeric),
    rankFieldsByPrompt(prompt, groupable),
  ]);

  const metric = metricRanks[0]?.field?.name;
  const dimension = dimensionRanks[0]?.field?.name;
  const aggregation = inferAggregation(prompt);
  const filters = inferFilters(prompt, schema);
  const limit = inferLimit(prompt);
  const sort = inferSort(prompt);

  const warnings: string[] = [];

  if (!metric && chartChoice.label !== "table" && chartChoice.label !== "kpi") {
    warnings.push("I could not confidently identify a numeric measure.");
  }
  if (!dimension && chartChoice.label !== "kpi") {
    warnings.push("I could not confidently identify a grouping field.");
  }

  const sortField =
    chartChoice.label === "kpi" ? metric : (metric ?? dimension);

  return {
    confidence: Math.min(
      1,
      ((chartChoice.score ?? 0) +
        (metricRanks[0]?.score ?? 0) +
        (dimensionRanks[0]?.score ?? 0)) /
        3,
    ),
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
        limit,
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
        ModelSingleton.getZeroShot((x) =>
          self.postMessage({ type: "progress", payload: x }),
        ),
        ModelSingleton.getEmbedder((x) =>
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
