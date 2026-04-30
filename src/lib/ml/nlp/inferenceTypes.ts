import type { FilterSpec, SchemaField } from "@/lib/ml/types";

export type FilterValue = FilterSpec["value"];

export type ParseRequest = {
  type: "parse";
  prompt: string;
  schema: SchemaField[];
};

export type InitRequest = {
  type: "init";
};

export type WorkerRequest = ParseRequest | InitRequest;

export type InferenceBackend = "webgpu" | "wasm";
export type FieldRole = "metric" | "dimension" | "filter";

export type RankedField = {
  field: SchemaField;
  score: number;
  semanticScore: number;
  nameScore: number;
  sampleScore: number;
  priorScore: number;
  matchedSample?: FilterValue;
};

export type ExactFilterPredicate = {
  op: FilterSpec["op"];
  value: FilterValue;
  score: number;
};
