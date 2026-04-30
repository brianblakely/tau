import type { Aggregation } from "@/lib/ml/types";
import { InferenceEngine } from "./runtime";
import { normalizeText } from "./text";

function inferAggregationHeuristic(prompt: string): Aggregation | undefined {
  const p = normalizeText(prompt);
  if (/\baverage\b|\bavg\b|\bmean\b/.test(p)) return "avg";
  if (/\bcount\b|\bhow many\b|\bnumber of\b/.test(p)) return "count";
  if (/\bminimum\b|\bmin\b|\blowest\b/.test(p)) return "min";
  if (/\bmaximum\b|\bmax\b|\bhighest\b/.test(p)) return "max";
  if (/\bsum\b|\btotal\b/.test(p)) return "sum";
  return undefined;
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
