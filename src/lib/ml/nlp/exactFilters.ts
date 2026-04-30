import type { SchemaField } from "@/lib/ml/types";
import {
  filterOperatorForContext,
  filterOperatorScoreBoost,
} from "./filterOperators";
import type { ExactFilterPredicate, FilterValue } from "./inferenceTypes";
import { representativeSampleValues } from "./samples";
import { escapeRegExp, normalizeText } from "./text";

export function exactSamplePredicateMatches(
  prompt: string,
  field: SchemaField,
): ExactFilterPredicate[] {
  const p = normalizeText(prompt);
  if (!p) return [];

  const values = representativeSampleValues(field, Infinity)
    .map((rawValue) => {
      return { rawValue, value: normalizeText(String(rawValue)) };
    })
    .filter(({ value }) => value.length > 0)
    .sort((a, b) => b.value.length - a.value.length);

  const matches: ExactFilterPredicate[] = [];

  for (const { rawValue, value } of values) {
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(value)}(?=$|\\s)`, "g");
    let match: RegExpExecArray | null = pattern.exec(p);

    while (match !== null) {
      const leadingWhitespaceLength = match[1]?.length ?? 0;
      const start = match.index + leadingWhitespaceLength;
      const end = start + value.length;
      const op = filterOperatorForContext(p, start, end);

      matches.push({
        op,
        value: rawValue,
        score: 1.1 + filterOperatorScoreBoost(op),
      });

      match = pattern.exec(p);
    }
  }

  return dedupeExactFilterPredicates(matches);
}

function dedupeExactFilterPredicates(
  predicates: ExactFilterPredicate[],
): ExactFilterPredicate[] {
  const seen = new Set<string>();
  const out: ExactFilterPredicate[] = [];

  for (const predicate of predicates) {
    const key = `${predicate.op}:${normalizeText(String(predicate.value))}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(predicate);
  }

  return out.sort((a, b) => b.score - a.score);
}

export function exactSampleMatch(
  prompt: string,
  field: SchemaField,
): FilterValue | undefined {
  return exactSamplePredicateMatches(prompt, field)[0]?.value;
}
