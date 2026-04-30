import type { FilterSpec, SchemaField } from "@/lib/ml/types";
import { exactSamplePredicateMatches } from "./exactFilters";
import { inferSemanticSampleMatch, rankFieldsByPrompt } from "./fieldRanking";
import { escapeRegExp, normalizeText } from "./text";

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

export async function inferFilters(
  prompt: string,
  schema: SchemaField[],
): Promise<FilterSpec[]> {
  const filterable = schema.filter(
    (field) => field.kind === "string" || field.kind === "date",
  );

  const explicitGroupByFieldNames = new Set(
    filterable
      .filter((field) => promptExplicitlyGroupsByField(prompt, field))
      .map((field) => field.name),
  );

  const ranked = await rankFieldsByPrompt(prompt, filterable, "filter");
  const topFields = ranked.slice(0, 8);

  const matches = (
    await Promise.all(
      topFields.map(async (rankedField) => {
        const exactPredicates = exactSamplePredicateMatches(
          prompt,
          rankedField.field,
        );

        if (exactPredicates.length) {
          return exactPredicates
            .filter((predicate) => {
              const fieldIsAlreadyGrouped = explicitGroupByFieldNames.has(
                rankedField.field.name,
              );

              return !(fieldIsAlreadyGrouped && predicate.op === "=");
            })
            .map((predicate) => {
              return {
                score: rankedField.score + predicate.score,
                filter: {
                  field: rankedField.field.name,
                  op: predicate.op,
                  value: predicate.value,
                },
              };
            });
        }

        if (explicitGroupByFieldNames.has(rankedField.field.name)) {
          return [];
        }

        const semanticMatch = await inferSemanticSampleMatch(
          prompt,
          rankedField.field,
        );

        if (!semanticMatch) return [];

        const totalScore = rankedField.score + semanticMatch.score;
        if (totalScore < 1.15) return [];

        return [
          {
            score: totalScore,
            filter: {
              field: rankedField.field.name,
              op: "=" as const,
              value: semanticMatch.rawValue,
            },
          },
        ];
      }),
    )
  ).flat();

  return dedupeFilters(
    matches.sort((a, b) => b.score - a.score).map((match) => match.filter),
  ).slice(0, 4);
}

function dedupeFilters(filters: FilterSpec[]) {
  const seen = new Set<string>();
  return filters.filter((filter) => {
    const key = `${filter.field}:${filter.op}:${JSON.stringify(filter.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
