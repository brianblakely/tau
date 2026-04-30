import type { SchemaField } from "@/lib/ml/types";
import type { FilterValue } from "./inferenceTypes";
import { normalizeText } from "./text";

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

export function representativeSampleValues(
  field: SchemaField,
  max = 12,
): FilterValue[] {
  return uniqueByNormalized(field.sampleValues ?? []).slice(0, max);
}
