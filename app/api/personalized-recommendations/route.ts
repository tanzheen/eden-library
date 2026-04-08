import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  averageEmbeddings,
  cosineSimilarity,
  parseEmbedding,
} from "@/lib/embedding-utils";

interface BookRecord {
  id: number;
  title: string;
  author: string;
  description: string | null;
  cover_url: string | null;
  genre_tag: string | null;
  difficulty: string | null;
  purpose: string | null;
  embedding: unknown;
  owner_name: string | null;
  owner_id: string | null;
  status: boolean;
  current_borrower_id?: string | null;
  created_at: string;
  updated_at: string;
  isbn: string | null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ recommendations: [] });
    }

    const admin = createAdminClient();

    const [{ data: recentClicks, error: clicksError }, { data: recentOrders, error: ordersError }] =
      await Promise.all([
        admin
          .from("clicks")
          .select("book_id")
          .eq("user_id", user.id)
          .order("clicked_at", { ascending: false })
          .limit(3),
        admin
          .from("orders")
          .select("book_id")
          .eq("borrower_id", user.id)
          .in("status", ["requested", "borrowed", "returned"])
          .order("created_at", { ascending: false })
          .limit(2),
      ]);

    if (clicksError) {
      return NextResponse.json({ error: clicksError.message }, { status: 500 });
    }

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    const sourceBookIds = [
      ...new Set([
        ...(recentClicks || []).map((row) => row.book_id),
        ...(recentOrders || []).map((row) => row.book_id),
      ]),
    ];

    if (sourceBookIds.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    const { data: sourceBooks, error: sourceBooksError } = await admin
      .from("books")
      .select(
        "id, title, author, description, cover_url, genre_tag, difficulty, purpose, embedding, owner_name, owner_id, status, current_borrower_id, created_at, updated_at, isbn"
      )
      .in("id", sourceBookIds);

    if (sourceBooksError) {
      return NextResponse.json(
        { error: sourceBooksError.message },
        { status: 500 }
      );
    }

    const sourceEmbeddings = ((sourceBooks || []) as BookRecord[])
      .map((book) => parseEmbedding(book.embedding))
      .filter((embedding): embedding is number[] => Boolean(embedding));

    const queryEmbedding = averageEmbeddings(sourceEmbeddings);

    if (!queryEmbedding) {
      return NextResponse.json({ recommendations: [] });
    }

    const { data: previousOrders, error: previousOrdersError } = await admin
      .from("orders")
      .select("book_id")
      .eq("borrower_id", user.id)
      .in("status", ["requested", "borrowed", "returned"]);

    if (previousOrdersError) {
      return NextResponse.json(
        { error: previousOrdersError.message },
        { status: 500 }
      );
    }

    const excludedBookIds = [
      ...new Set([
        ...sourceBookIds,
        ...(previousOrders || []).map((row) => row.book_id),
      ]),
    ];

    let candidateQuery = admin
      .from("books")
      .select(
        "id, title, author, description, cover_url, genre_tag, difficulty, purpose, embedding, owner_name, owner_id, status, current_borrower_id, created_at, updated_at, isbn"
      )
      .eq("status", true)
      .neq("owner_id", user.id)
      .not("embedding", "is", null);

    if (excludedBookIds.length > 0) {
      candidateQuery = candidateQuery.not(
        "id",
        "in",
        `(${excludedBookIds.join(",")})`
      );
    }

    const { data: candidateBooks, error: candidateBooksError } =
      await candidateQuery.limit(300);

    if (candidateBooksError) {
      return NextResponse.json(
        { error: candidateBooksError.message },
        { status: 500 }
      );
    }

    const rankedBooks = ((candidateBooks || []) as BookRecord[])
      .map((book) => {
        const embedding = parseEmbedding(book.embedding);
        return embedding
          ? {
              ...book,
              similarity: cosineSimilarity(queryEmbedding, embedding),
            }
          : null;
      })
      .filter(
        (book): book is BookRecord & { similarity: number } =>
          Boolean(book) && book.similarity > 0
      )
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 8)
      .map((book) => ({
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
        current_borrower_id: book.current_borrower_id || null,
        created_at: book.created_at,
        updated_at: book.updated_at,
        isbn: book.isbn,
        embedding: null,
      }));

    return NextResponse.json({
      recommendations: rankedBooks,
      debug: {
        clickSeeds: (recentClicks || []).length,
        orderSeeds: (recentOrders || []).length,
        sourceEmbeddings: sourceEmbeddings.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate personalized recommendations",
      },
      { status: 500 }
    );
  }
}
