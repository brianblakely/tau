import { InferenceEngine } from "./runtime";
import { normalizeText } from "./text";

export function inferLimit(prompt: string): number | undefined {
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
