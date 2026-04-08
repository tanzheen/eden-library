export function parseEmbedding(value: unknown) {
  if (!value) return null;

  if (Array.isArray(value)) {
    const numeric = value.filter((item): item is number => typeof item === "number");
    return numeric.length > 0 ? numeric : null;
  }

  if (typeof value === "object") {
    const maybeValues = (value as { values?: unknown }).values;
    if (Array.isArray(maybeValues)) {
      const numeric = maybeValues.filter(
        (item): item is number => typeof item === "number"
      );
      return numeric.length > 0 ? numeric : null;
    }
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }

  const parsed = trimmed
    .slice(1, -1)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));

  return parsed.length > 0 ? parsed : null;
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) {
    return -1;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return -1;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function averageEmbeddings(vectors: number[][]) {
  if (vectors.length === 0) {
    return null;
  }

  const dims = vectors[0].length;
  if (!vectors.every((vector) => vector.length === dims)) {
    return null;
  }

  const sums = new Array<number>(dims).fill(0);

  vectors.forEach((vector) => {
    vector.forEach((value, index) => {
      sums[index] += value;
    });
  });

  return sums.map((value) => value / vectors.length);
}
