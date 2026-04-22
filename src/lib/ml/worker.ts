import type {
  DataType,
  FeatureExtractionPipeline,
  ZeroShotClassificationPipeline,
} from "@huggingface/transformers";
import { ModelRegistry, pipeline } from "@huggingface/transformers";
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

// Progressively-enhanced inference engine with dynamic backend and dtype selection.
type InferenceBackend = "webgpu" | "wasm";

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

const preferredDtypes = (backend: InferenceBackend): DataType[] => {
  return backend === "webgpu" ? ["q8", "q4", "fp32"] : ["q8", "q4", "fp32"];
};

const chooseDtype = async (
  model: string,
  backend: InferenceBackend,
): Promise<DataType> => {
  try {
    const available = await ModelRegistry.get_available_dtypes(model);
    return (
      preferredDtypes(backend).find((x) => available.includes(x)) ?? "fp32"
    );
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
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function dot(a: number[], b: number[]) {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += a[i] * b[i];
  return total;
}

async function embedTexts(texts: string[]) {
  const embedder = await InferenceEngine.getEmbedder();
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
