import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { tavily } from "@tavily/core";
import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateBookMetadataPrompt,
  BookMetadataResult,
  BOOK_GENRES,
  BOOK_DIFFICULTIES,
  BOOK_PURPOSES,
} from "@/lib/prompts/book-metadata-prompt";

// Allow up to 60 seconds for background processing
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { bookName, authorName, bookId } = await request.json();

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
      await processBookMetadata(bookId, bookName, authorName);
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
  authorName: string
) {
  console.log(`[Background] Starting metadata generation for book ${bookId}: "${bookName}"`);

  try {
    const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! });
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const supabase = createAdminClient();

    // Run both Tavily searches in parallel
    const [bookInfoResult, difficultyResult] = await Promise.all([
      tavilyClient.search(`${bookName} by ${authorName}`, {
        includeAnswer: "basic",
        searchDepth: "advanced",
        includeImages: true,
        maxResults: 2,
      }),
      tavilyClient.search(`${bookName} by ${authorName} reading difficulty`, {
        includeAnswer: "basic",
        searchDepth: "advanced",
        maxResults: 2,
      }),
    ]);

    console.log(`[Background] Tavily search complete for book ${bookId}`);

    // Get the first image URL
    const images = bookInfoResult.images || [];
    let savedImageUrl: string | null = null;
    if (images.length > 0) {
      const firstImage = images[0];
      const imageUrl = typeof firstImage === "string" ? firstImage : firstImage?.url || null;

      if (imageUrl) {
        try {
          savedImageUrl = await uploadImageToSupabase(imageUrl, bookId);
        } catch (imageError) {
          console.error(`[Background] Failed to upload image for book ${bookId}:`, imageError);
          savedImageUrl = imageUrl; // Fall back to original URL
        }
      }
    }

    // Prepare content for Gemini
    const searchContent = bookInfoResult.results?.[0]?.content || "";

    const prompt = generateBookMetadataPrompt({
      bookName,
      authorName,
      bookInfoAnswer: bookInfoResult.answer || "",
      difficultyAnswer: difficultyResult.answer || "",
      searchContent,
    });

    // Call Gemini to generate metadata
    const response = await genai.models.generateContent({
      model: "gemma-4-31b-it",
      contents: prompt,
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
      if (!BOOK_GENRES.includes(metadata.genre as any)) {
        metadata.genre = "Theology";
      }
      if (!BOOK_DIFFICULTIES.includes(metadata.difficulty as any)) {
        metadata.difficulty = "Casual Reading";
      }
      if (!BOOK_PURPOSES.includes(metadata.purpose as any)) {
        metadata.purpose = "Devotional/Reflection";
      }
    } catch (parseError) {
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
          model: "text-embedding-004",
          contents: metadata.description,
        });
        embedding = embeddingResponse.embeddings?.[0]?.values || null;
        console.log(`[Background] Embedding complete for book ${bookId}`);
      } catch (embeddingError) {
        console.error(`[Background] Failed to generate embedding for book ${bookId}:`, embeddingError);
      }
    }

    // Update the book in Supabase (ISBN is already set by add-book route)
    const updateData: Record<string, unknown> = {
      genre_tag: metadata.genre,
      difficulty: metadata.difficulty,
      purpose: metadata.purpose,
      description: metadata.description,
      embedding: embedding,
    };

    if (savedImageUrl) {
      // Only update cover_url if the book doesn't already have one
      const { data: currentBook } = await supabase
        .from("books")
        .select("cover_url")
        .eq("id", bookId)
        .single();

      if (!currentBook?.cover_url) {
        updateData.cover_url = savedImageUrl;
      }
    }

    const { error: updateError } = await supabase
      .from("books")
      .update(updateData)
      .eq("id", bookId);

    if (updateError) {
      console.error(`[Background] Failed to update book ${bookId}:`, updateError);
    } else {
      console.log(`[Background] Successfully updated book ${bookId} with metadata`);
    }
  } catch (error) {
    console.error(`[Background] Error processing book ${bookId}:`, error);
  }
}

async function uploadImageToSupabase(
  imageUrl: string,
  bookId: number
): Promise<string> {
  const supabase = createAdminClient();

  // Fetch the image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
  }

  const imageBlob = await imageResponse.blob();
  const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

  // Determine file extension
  let extension = "jpg";
  if (contentType.includes("png")) {
    extension = "png";
  } else if (contentType.includes("webp")) {
    extension = "webp";
  } else if (contentType.includes("gif")) {
    extension = "gif";
  }

  const fileName = `book-covers/${bookId}-${Date.now()}.${extension}`;

  // Convert blob to ArrayBuffer for upload
  const arrayBuffer = await imageBlob.arrayBuffer();

  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from("images")
    .upload(fileName, arrayBuffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("images").getPublicUrl(fileName);

  return publicUrl;
}
