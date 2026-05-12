import { fieldToDescriptor } from "@/lib/ml/schema";
import type { Aggregation, FilterSpec, SchemaField } from "@/lib/ml/types";

export type FilterValue = FilterSpec["value"];
export type FieldRole = "metric" | "dimension" | "filter";

export type FilterOperatorRule = {
  op: FilterSpec["op"];
  scoreBoost: number;
  before?: RegExp[];
  after?: RegExp[];
};

export type ExactFilterPredicate = {
  op: FilterSpec["op"];
  value: FilterValue;
  score: number;
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

const FILTER_OPERATOR_RULES: FilterOperatorRule[] = [
  {
    op: "!=",
    scoreBoost: 0.25,
    before: [
      /\bbut\s+not\s+$/,
      /\bnot\s+$/,
      /\bbut\s+$/,
      /\bexcept\s+$/,
      /\bexcluding\s+$/,
      /\bexclude\s+$/,
      /\bwithout\s+$/,
      /\bbesides\s+$/,
      /\bother\s+than\s+$/,
      /\bis\s+not\s+$/,
      /\bare\s+not\s+$/,
      /\bnot\s+equal\s+to\s+$/,
      /\bnot\s+equals\s+$/,
      /\bisnt\s+$/,
      /\barent\s+$/,
      /\bdont\s+(?:include|show|use)\s+$/,
      /\bdo\s+not\s+(?:include|show|use)\s+$/,
      /\bdoesnt\s+(?:include|show|use)\s+$/,
      /\bdoes\s+not\s+(?:include|show|use)\s+$/,
    ],
    after: [/^\s+(?:excluded|removed|omitted)\b/],
  },
];

export function inferAggregationHeuristic(
  prompt: string,
): Aggregation | undefined {
  const p = normalizeText(prompt);
  if (/\baverage\b|\bavg\b|\bmean\b/.test(p)) return "avg";
  if (/\bcount\b|\bhow many\b|\bnumber of\b/.test(p)) return "count";
  if (/\bminimum\b|\bmin\b|\blowest\b/.test(p)) return "min";
  if (/\bmaximum\b|\bmax\b|\bhighest\b/.test(p)) return "max";
  if (/\bsum\b|\btotal\b/.test(p)) return "sum";
  return undefined;
}

export function inferLimit(prompt: string): number | undefined {
  const p = normalizeText(prompt);
  const topMatch = p.match(/\btop\s+(\d+)\b/);
  if (topMatch) return Number(topMatch[1]);

  const bottomMatch = p.match(/\bbottom\s+(\d+)\b/);
  if (bottomMatch) return Number(bottomMatch[1]);

  return undefined;
}

export function inferSortHeuristic(prompt: string) {
  const p = normalizeText(prompt);

  if (/\bdescending\b|\bdesc\b|\bhighest\b|\blargest\b|\btop\b/.test(p)) {
    return { direction: "desc" as const };
  }
  if (/\bascending\b|\basc\b|\blowest\b|\bsmallest\b|\bbottom\b/.test(p)) {
    return { direction: "asc" as const };
  }
  return undefined;
}

export function normalizeText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[’']/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function tokenize(s: string) {
  return normalizeText(s).split(" ").filter(Boolean);
}

export function hasWholePhrase(haystack: string, needle: string) {
  if (!needle) return false;
  return new RegExp(`(^|\\s)${escapeRegExp(needle)}($|\\s)`).test(haystack);
}

export function extractPromptPhrases(
  prompt: string,
  maxN = 4,
  maxPhrases = 24,
) {
  const tokens = tokenize(prompt).filter(
    (token) => token.length > 1 && !STOPWORDS.has(token),
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

export function chooseTitle(prompt: string) {
  return prompt.trim().replace(/\.$/, "");
}

export function filterOperatorForContext(
  normalizedPrompt: string,
  start: number,
  end: number,
): FilterSpec["op"] {
  const before = normalizedPrompt.slice(Math.max(0, start - 96), start);
  const after = normalizedPrompt.slice(
    end,
    Math.min(normalizedPrompt.length, end + 96),
  );

  for (const rule of FILTER_OPERATOR_RULES) {
    const matchesBefore = rule.before?.some((pattern) => pattern.test(before));
    const matchesAfter = rule.after?.some((pattern) => pattern.test(after));

    if (matchesBefore || matchesAfter) return rule.op;
  }

  return "=";
}

export function filterOperatorScoreBoost(op: FilterSpec["op"]) {
  return FILTER_OPERATOR_RULES.find((rule) => rule.op === op)?.scoreBoost ?? 0;
}

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

export function exactSampleMatch(
  prompt: string,
  field: SchemaField,
): FilterValue | undefined {
  return exactSamplePredicateMatches(prompt, field)[0]?.value;
}

export function representativeSampleValues(
  field: SchemaField,
  max = 12,
): FilterValue[] {
  return uniqueByNormalized(field.sampleValues ?? []).slice(0, max);
}

export function rolePrior(field: SchemaField, role: FieldRole) {
  if (role === "metric") return field.kind === "number" ? 0.15 : -0.2;
  if (role === "dimension")
    return field.kind === "string" || field.kind === "date" ? 0.12 : -0.15;
  if (role === "filter")
    return field.kind === "string" || field.kind === "date" ? 0.08 : -0.1;
  return 0;
}

export function fieldNameMentionScore(prompt: string, field: SchemaField) {
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

export function buildFieldSemanticText(field: SchemaField, role: FieldRole) {
  const samples = representativeSampleValues(field, 8)
    .map((value) => String(value))
    .join(", ");

  return [
    fieldToDescriptor(field),
    `role: ${role}`,
    samples ? `common values: ${samples}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}

export function promptExplicitlyGroupsByField(
  prompt: string,
  field: SchemaField,
) {
  const p = normalizeText(prompt);
  const fieldName = normalizeText(field.name);
  return new RegExp(
    `\\b(by|per|across|over|grouped by|broken down by)\\s+${escapeRegExp(fieldName)}\\b`,
  ).test(p);
}

export function dedupeFilters(filters: FilterSpec[]) {
  const seen = new Set<string>();
  return filters.filter((filter) => {
    const key = `${filter.field}:${filter.op}:${JSON.stringify(filter.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
