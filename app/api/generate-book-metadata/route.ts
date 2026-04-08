import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BookMetadataResult,
  BookGenre,
  BookDifficulty,
  BookPurpose,
  BOOK_GENRES,
  BOOK_DIFFICULTIES,
  BOOK_PURPOSES,
} from "@/lib/prompts/book-metadata-prompt";
import {
  prepareBookMetadataInput,
  PreparedBookMetadataInput,
} from "@/lib/book-metadata-prep";

// Allow up to 60 seconds for background processing
export const maxDuration = 60;

function toPgVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}

export async function POST(request: NextRequest) {
  try {
    const { bookName, authorName, bookId, preparedMetadata } =
      await request.json();

    if (!bookName || !authorName) {
      return NextResponse.json(
        { error: "Book name and author are required" },
        { status: 400 }
      );
    }

    if (!bookId) {
      return NextResponse.json(
        { error: "Book ID is required for background processing" },
        { status: 400 }
      );
    }

    // Validate API keys are present
    if (!process.env.TAVILY_API_KEY) {
      console.error("TAVILY_API_KEY is not set");
      return NextResponse.json(
        { error: "Server configuration error: Missing Tavily API key" },
        { status: 500 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not set");
      return NextResponse.json(
        { error: "Server configuration error: Missing Gemini API key" },
        { status: 500 }
      );
    }

    // Schedule background processing and return immediately
    after(async () => {
      await processBookMetadata(bookId, bookName, authorName, preparedMetadata);
    });

    return NextResponse.json({
      success: true,
      processing: true,
      message: "Metadata generation started in background",
    });
  } catch (error) {
    console.error("Error initiating book metadata generation:", error);
    return NextResponse.json(
      { error: "Failed to start metadata generation" },
      { status: 500 }
    );
  }
}

async function processBookMetadata(
  bookId: number,
  bookName: string,
  authorName: string,
  preparedMetadata?: PreparedBookMetadataInput
) {
  console.log(`[Background] Starting metadata generation for book ${bookId}: "${bookName}"`);

  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const supabase = createAdminClient();

    const prepared =
      preparedMetadata || (await prepareBookMetadataInput(bookName, authorName)).preparedMetadata;

    if (!preparedMetadata) {
      console.log(`[Background] Tavily search complete for book ${bookId}`);
    }

    // Call Gemini to generate metadata
    const response = await genai.models.generateContent({
      model: "gemma-4-31b-it",
      contents: prepared.prompt,
    });

    console.log(`[Background] Gemini metadata complete for book ${bookId}`);

    const responseText = response.text || "";

    // Parse the JSON response
    let metadata: BookMetadataResult;
    try {
      const cleanedResponse = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      metadata = JSON.parse(cleanedResponse);

      // Validate the response
      if (!BOOK_GENRES.includes(metadata.genre as BookGenre)) {
        metadata.genre = "Theology";
      }
      if (!BOOK_DIFFICULTIES.includes(metadata.difficulty as BookDifficulty)) {
        metadata.difficulty = "Casual Reading";
      }
      if (!BOOK_PURPOSES.includes(metadata.purpose as BookPurpose)) {
        metadata.purpose = "Devotional/Reflection";
      }
    } catch {
      console.error(`[Background] Failed to parse Gemini response for book ${bookId}:`, responseText);
      metadata = {
        genre: "Theology",
        difficulty: "Casual Reading",
        purpose: "Devotional/Reflection",
        description: `${bookName} by ${authorName}.`,
      };
    }

    // Generate embedding for the description
    let embedding: number[] | null = null;
    if (metadata.description) {
      try {
        const embeddingResponse = await genai.models.embedContent({
          model: "gemini-embedding-001",
          contents: metadata.description,
        });
        embedding = embeddingResponse.embeddings?.[0]?.values || null;
        if (embedding) {
          console.log(
            `[Background] Embedding complete for book ${bookId} (${embedding.length} dimensions)`
          );
        } else {
          console.error(
            `[Background] No embedding values returned for book ${bookId}`
          );
        }
      } catch (embeddingError) {
        console.error(`[Background] Failed to generate embedding for book ${bookId}:`, embeddingError);
      }
    }

    const metadataUpdateData: Record<string, unknown> = {
      genre_tag: metadata.genre,
      difficulty: metadata.difficulty,
      purpose: metadata.purpose,
      description: metadata.description,
    };

    const { error: metadataUpdateError } = await supabase
      .from("books")
      .update(metadataUpdateData)
      .eq("id", bookId);

    if (metadataUpdateError) {
      console.error(
        `[Background] Failed to update metadata for book ${bookId}:`,
        metadataUpdateError
      );
    } else {
      console.log(
        `[Background] Successfully updated metadata for book ${bookId}`
      );
    }

    if (embedding) {
      const { error: embeddingUpdateError } = await supabase
        .from("books")
        .update({
          embedding: toPgVectorLiteral(embedding),
        })
        .eq("id", bookId);

      if (embeddingUpdateError) {
        console.error(
          `[Background] Failed to update embedding for book ${bookId}:`,
          embeddingUpdateError
        );
      } else {
        console.log(
          `[Background] Successfully updated embedding for book ${bookId}`
        );
      }
    }
  } catch (error) {
    console.error(`[Background] Error processing book ${bookId}:`, error);
  }
}
