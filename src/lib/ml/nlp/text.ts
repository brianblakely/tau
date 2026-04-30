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
