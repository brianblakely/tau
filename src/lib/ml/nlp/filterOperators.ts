import type { FilterSpec } from "@/lib/ml/types";

export type FilterOperatorRule = {
  op: FilterSpec["op"];
  scoreBoost: number;
  before?: RegExp[];
  after?: RegExp[];
};

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
