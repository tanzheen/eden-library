import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Use regular client for auth check
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { title, author, cover_url, existingBookMetadata } = body;

  if (!title || !author) {
    return NextResponse.json(
      { error: "Title and author are required" },
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
      }),
    }).catch((err) => {
      console.error("Failed to trigger metadata generation:", err);
    });
  }

  return NextResponse.json({ book: insertedBook });
}
