import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateBookRecommendationPrompt } from "@/lib/prompts/book-recommendation-prompt";

interface BookRecord {
  id: number;
  title: string;
  author: string;
  description: string | null;
  cover_url: string | null;
  genre_tag: string | null;
  difficulty: string | null;
  purpose: string | null;
  embedding: number[] | string | null;
  owner_name: string | null;
  owner_id: string | null;
  status: boolean;
}

function parseEmbedding(value: unknown) {
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

function cosineSimilarity(a: number[], b: number[]) {
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Server configuration error: Missing Gemini API key" },
        { status: 500 }
      );
    }

    const { query } = await request.json();

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { error: "Recommendation query is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const borrowedBookIds: number[] = [];

    let candidateQuery = adminClient
      .from("books")
      .select(
        "id, title, author, description, cover_url, genre_tag, difficulty, purpose, embedding, owner_name, owner_id, status"
      )
      .eq("status", true)
      .neq("owner_id", user.id)
      .not("embedding", "is", null);

    if (borrowedBookIds.length > 0) {
      candidateQuery = candidateQuery.not("id", "in", `(${borrowedBookIds.join(",")})`);
    }

    const { data: books, error: booksError } = await candidateQuery.limit(250);

    if (booksError) {
      return NextResponse.json({ error: booksError.message }, { status: 500 });
    }

    const parsedBooks = ((books || []) as BookRecord[])
      .map((book) => ({
        ...book,
        parsedEmbedding: parseEmbedding(book.embedding),
      }))
      .filter((book) => book.parsedEmbedding && book.parsedEmbedding.length > 0);

    if (parsedBooks.length === 0) {
      const booksWithRawEmbedding = ((books || []) as BookRecord[]).filter(
        (book) => book.embedding !== null
      );

      return NextResponse.json({
        answer:
          "I could not find any embeddable books to recommend yet. Add more books with metadata first.",
        recommendations: [],
        debug: {
          fetchedBooks: (books || []).length,
          booksWithRawEmbedding: booksWithRawEmbedding.length,
          sampleEmbeddingType: booksWithRawEmbedding[0]?.embedding
            ? typeof booksWithRawEmbedding[0].embedding
            : null,
          sampleEmbeddingPreview: booksWithRawEmbedding[0]?.embedding
            ? JSON.stringify(booksWithRawEmbedding[0].embedding).slice(0, 200)
            : null,
          parsedEmbeddings: parsedBooks.length,
        },
      });
    }

    const embeddingResponse = await genai.models.embedContent({
      model: "gemini-embedding-001",
      contents: query.trim(),
    });

    const queryEmbedding = embeddingResponse.embeddings?.[0]?.values || null;

    if (!queryEmbedding) {
      return NextResponse.json(
        { error: "Failed to generate query embedding" },
        { status: 500 }
      );
    }

    const rankedBooks = parsedBooks
      .map((book) => ({
        ...book,
        similarity: cosineSimilarity(queryEmbedding, book.parsedEmbedding!),
      }))
      .filter((book) => book.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 6);

    if (rankedBooks.length === 0) {
      return NextResponse.json({
        answer:
          "I could not find any close matches for that request among books you have not borrowed before.",
        recommendations: [],
      });
    }

    const borrowedTitles =
      borrowedBookIds.length > 0
        ? (
            await adminClient
              .from("books")
              .select("title")
              .in("id", borrowedBookIds)
          ).data?.map((book) => book.title) || []
        : [];

    const prompt = generateBookRecommendationPrompt({
      userQuery: query.trim(),
      borrowedTitles,
      candidateBooks: rankedBooks.map((book) => ({
        title: book.title,
        author: book.author,
        ownerName: book.owner_name,
        genre: book.genre_tag,
        difficulty: book.difficulty,
        purpose: book.purpose,
        description: book.description,
        similarity: book.similarity,
      })),
    });

    const response = await genai.models.generateContent({
      model: "gemma-4-31b-it",
      contents: prompt,
    });

    return NextResponse.json({
      answer:
        response.text ||
        "Here are the closest books I found for your request.",
      recommendations: rankedBooks.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        description: book.description,
        cover_url: book.cover_url,
        genre_tag: book.genre_tag,
        difficulty: book.difficulty,
        purpose: book.purpose,
        owner_name: book.owner_name,
        owner_id: book.owner_id,
        status: book.status,
        created_at: "",
        updated_at: "",
        isbn: null,
        embedding: null,
      })),
      debug: {
        fetchedBooks: (books || []).length,
        parsedEmbeddings: parsedBooks.length,
        topSimilarity: rankedBooks[0]?.similarity ?? null,
        sampleDimensions: parsedBooks[0]?.parsedEmbedding?.length ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate recommendations",
      },
      { status: 500 }
    );
  }
}
