import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSupabaseStorageUrl,
  uploadImageToSupabase,
} from "@/lib/book-cover-storage";
import { isBlockedBookCoverUrl } from "@/lib/book-cover-sources";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Use regular client for auth check
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { title, author, cover_url, existingBookMetadata, preparedMetadata } =
    body;

  if (!title || !author) {
    return NextResponse.json(
      { error: "Title and author are required" },
      { status: 400 }
    );
  }

  if (cover_url && isBlockedBookCoverUrl(cover_url)) {
    return NextResponse.json(
      { error: "Please choose a cover image from a different source." },
      { status: 400 }
    );
  }

  // Use admin client to bypass RLS
  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (e) {
    console.error("Admin client error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create admin client" },
      { status: 500 }
    );
  }

  // Build insert data
  const insertData: Record<string, unknown> = {
    title,
    author,
    owner_name: user.user_metadata?.full_name || user.email,
    owner_id: user.id,
    cover_url: cover_url || null,
    cover_url_downloaded: isSupabaseStorageUrl(cover_url || "")
      ? cover_url
      : null,
    status: true,
  };

  // Track if we need to generate metadata (for new books without existing data)
  let needsMetadataGeneration = false;

  // If we have existing book metadata (from autocomplete), copy it including ISBN
  if (existingBookMetadata?.isbn) {
    insertData.genre_tag = existingBookMetadata.genre_tag;
    insertData.difficulty = existingBookMetadata.difficulty;
    insertData.purpose = existingBookMetadata.purpose;
    insertData.description = existingBookMetadata.description;
    insertData.embedding = existingBookMetadata.embedding;
    insertData.isbn = existingBookMetadata.isbn;
  } else {
    // No existing metadata - check if same book exists in DB to share ISBN
    const { data: existingBooks } = await adminClient
      .from("books")
      .select("isbn, genre_tag, difficulty, purpose, description, embedding")
      .ilike("title", title)
      .ilike("author", author)
      .not("isbn", "is", null)
      .limit(1);

    const existingBook = existingBooks?.[0];

    if (existingBook?.isbn) {
      // Reuse ISBN and metadata from existing book
      insertData.isbn = existingBook.isbn;
      insertData.genre_tag = existingBook.genre_tag;
      insertData.difficulty = existingBook.difficulty;
      insertData.purpose = existingBook.purpose;
      insertData.description = existingBook.description;
      insertData.embedding = existingBook.embedding;
    } else {
      // Generate new ISBN (format: EDEN-XXXX)
      const { data: lastBooks } = await adminClient
        .from("books")
        .select("isbn")
        .like("isbn", "EDEN-%")
        .order("isbn", { ascending: false })
        .limit(1);

      let nextNumber = 1;
      const lastBook = lastBooks?.[0];
      if (lastBook?.isbn) {
        const match = lastBook.isbn.match(/EDEN-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      insertData.isbn = `EDEN-${nextNumber.toString().padStart(4, "0")}`;
      needsMetadataGeneration = true; // New book needs metadata generation
    }
  }

  const { data: insertedBook, error } = await adminClient
    .from("books")
    .insert([insertData])
    .select()
    .single();

  if (error) {
    console.error("Insert error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  let finalBook = insertedBook;

  if (
    insertedBook.cover_url &&
    !isSupabaseStorageUrl(insertedBook.cover_url)
  ) {
    try {
      const uploadedCoverUrl = await uploadImageToSupabase(
        insertedBook.cover_url,
        insertedBook.id,
        session?.access_token
      );

      const { data: updatedBook, error: coverUpdateError } = await adminClient
        .from("books")
        .update({ cover_url_downloaded: uploadedCoverUrl })
        .eq("id", insertedBook.id)
        .select()
        .single();

      if (coverUpdateError) {
        console.error("Failed to update book with Supabase cover URL:", coverUpdateError);
      } else if (updatedBook) {
        finalBook = updatedBook;
      }
    } catch (coverUploadError) {
      console.error("Failed to upload chosen cover to Supabase Storage:", coverUploadError);
    }
  } else if (insertedBook.cover_url && isSupabaseStorageUrl(insertedBook.cover_url)) {
    const { data: updatedBook, error: coverUpdateError } = await adminClient
      .from("books")
      .update({ cover_url_downloaded: insertedBook.cover_url })
      .eq("id", insertedBook.id)
      .select()
      .single();

    if (coverUpdateError) {
      console.error("Failed to sync downloaded cover URL:", coverUpdateError);
    } else if (updatedBook) {
      finalBook = updatedBook;
    }
  }

  // Trigger metadata generation for new books (runs in background)
  if (needsMetadataGeneration && insertedBook) {
    const origin = new URL(request.url).origin;
    fetch(`${origin}/api/generate-book-metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId: insertedBook.id,
        bookName: title,
        authorName: author,
        preparedMetadata: preparedMetadata || null,
      }),
    }).catch((err) => {
      console.error("Failed to trigger metadata generation:", err);
    });
  }

  return NextResponse.json({ book: finalBook });
}
