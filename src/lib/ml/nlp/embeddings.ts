import { InferenceEngine } from "./runtime";
import { normalizeText } from "./text";

const embeddingCache = new Map<string, number[]>();

export function dot(a: number[], b: number[]) {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += a[i] * b[i];
  return total;
}

export async function embedTexts(texts: string[]) {
  const keys = texts.map(normalizeText);
  const missing = Array.from(
    new Set(keys.filter((key) => key && !embeddingCache.has(key))),
  );

  if (missing.length) {
    const embedder = await InferenceEngine.getEmbedder();
    const tensor = await embedder(missing, {
      pooling: "mean",
      normalize: true,
    });

    const dims = tensor.dims as number[];
    const width = dims[dims.length - 1];
    const data = Array.from(tensor.data as Float32Array);

    for (let i = 0; i < missing.length; i++) {
      embeddingCache.set(missing[i], data.slice(i * width, (i + 1) * width));
    }
  }

  return keys.map((key) => {
    const vec = embeddingCache.get(key);
    if (!vec) throw new Error(`Missing embedding for "${key}"`);
    return vec;
  });
}
