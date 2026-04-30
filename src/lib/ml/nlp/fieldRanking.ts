import { fieldToDescriptor } from "@/lib/ml/schema";
import type { SchemaField } from "@/lib/ml/types";
import { dot, embedTexts } from "./embeddings";
import { exactSampleMatch } from "./exactFilters";
import type { FieldRole, FilterValue, RankedField } from "./inferenceTypes";
import { representativeSampleValues } from "./samples";
import { extractPromptPhrases, hasWholePhrase, normalizeText } from "./text";

function rolePrior(field: SchemaField, role: FieldRole) {
  if (role === "metric") return field.kind === "number" ? 0.15 : -0.2;
  if (role === "dimension")
    return field.kind === "string" || field.kind === "date" ? 0.12 : -0.15;
  if (role === "filter")
    return field.kind === "string" || field.kind === "date" ? 0.08 : -0.1;
  return 0;
}

function fieldNameMentionScore(prompt: string, field: SchemaField) {
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

function buildFieldSemanticText(field: SchemaField, role: FieldRole) {
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

export async function rankFieldsByPrompt(
  prompt: string,
  fields: SchemaField[],
  role: FieldRole,
): Promise<RankedField[]> {
  if (!fields.length) return [];

  const semanticTexts = fields.map((field) =>
    buildFieldSemanticText(field, role),
  );
  const vectors = await embedTexts([prompt, ...semanticTexts]);
  const [promptVec, ...fieldVecs] = vectors;

  return fields
    .map((field, i) => {
      const semanticScore = dot(promptVec, fieldVecs[i]);
      const nameScore = fieldNameMentionScore(prompt, field);
      const matchedSample = exactSampleMatch(prompt, field);
      const sampleScore =
        matchedSample === undefined ? 0 : role === "filter" ? 0.5 : 0.22;
      const priorScore = rolePrior(field, role);

      return {
        field,
        score: semanticScore + nameScore + sampleScore + priorScore,
        semanticScore,
        nameScore,
        sampleScore,
        priorScore,
        matchedSample,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export async function inferSemanticSampleMatch(
  prompt: string,
  field: SchemaField,
): Promise<{ rawValue: FilterValue; score: number } | null> {
  const exact = exactSampleMatch(prompt, field);
  if (exact !== undefined) return { rawValue: exact, score: 1.1 };

  const values = representativeSampleValues(field, 20);
  if (!values.length) return null;

  const phrases = extractPromptPhrases(prompt);
  const valueTexts = values.map((value) => String(value));
  const vectors = await embedTexts([...phrases, ...valueTexts]);

  const phraseVecs = vectors.slice(0, phrases.length);
  const valueVecs = vectors.slice(phrases.length);

  let bestIndex = -1;
  let bestScore = -1;

  for (let i = 0; i < values.length; i++) {
    const valueText = normalizeText(String(values[i]));
    if (!valueText) continue;

    for (let j = 0; j < phrases.length; j++) {
      const phrase = phrases[j];
      if (phrase.length < 3) continue;

      let score = dot(phraseVecs[j], valueVecs[i]);

      if (valueText.includes(phrase) || phrase.includes(valueText)) {
        score += 0.08;
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
  }

  if (bestIndex === -1 || bestScore < 0.62) return null;

  return {
    rawValue: values[bestIndex],
    score: bestScore,
  };
}
