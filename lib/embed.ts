import { google } from "@ai-sdk/google";
import { embed } from "ai";

/**
 * Generate an embedding for a query string using Google's gemini-embedding-001 model.
 * Returns a float array suitable for pgvector similarity search.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const { embedding } = await embed({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    value: query,
  });

  return embedding;
}
