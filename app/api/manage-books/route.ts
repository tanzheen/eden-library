import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface OrderRow {
  id: number;
  book_id: number;
  owner_id: string;
  borrower_id: string;
  owner_name: string | null;
  borrower_name: string | null;
  note: string | null;
  status: "requested" | "borrowed" | "returned" | "cancelled";
}

function isMissingColumnError(message?: string) {
  return message?.includes("column") || message?.includes("Could not find") || false;
}

async function fetchOrdersForUser(
  admin: ReturnType<typeof createAdminClient>,
  matchColumn: "owner_id" | "borrower_id",
  userId: string
) {
  const baseSelect = "id, book_id, owner_id, borrower_id, owner_name, borrower_name, status";

  const orderedQuery = await admin
    .from("orders")
    .select(baseSelect)
    .eq(matchColumn, userId)
    .in("status", ["requested", "borrowed"])
    .order("created_at", { ascending: false });

  if (!orderedQuery.error) {
    return orderedQuery;
  }

  if (!isMissingColumnError(orderedQuery.error.message)) {
    return orderedQuery;
  }

  console.warn(`Falling back to unordered orders query for ${matchColumn}:`, orderedQuery.error.message);

  return admin
    .from("orders")
    .select(baseSelect)
    .eq(matchColumn, userId)
    .in("status", ["requested", "borrowed"]);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = createAdminClient();

    const [{ data: ownedBooks, error: ownedError }, ownerOrdersResult, borrowerOrdersResult] = await Promise.all([
      admin
        .from("books")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),
      fetchOrdersForUser(admin, "owner_id", user.id),
      fetchOrdersForUser(admin, "borrower_id", user.id),
    ]);

    const { data: ownerOrders, error: ownerOrdersError } = ownerOrdersResult;
    const { data: borrowerOrders, error: borrowerOrdersError } = borrowerOrdersResult;

    if (ownedError || ownerOrdersError || borrowerOrdersError) {
      return NextResponse.json(
        {
          error:
            ownedError?.message ||
            ownerOrdersError?.message ||
            borrowerOrdersError?.message ||
            "Failed to load manage books data",
        },
        { status: 500 }
      );
    }

    const allOrders = [...((ownerOrders || []) as OrderRow[]), ...((borrowerOrders || []) as OrderRow[])];
    const bookIds = [...new Set(allOrders.map((order) => order.book_id))];

    const booksById = new Map<number, Record<string, unknown>>();

    if (bookIds.length > 0) {
      const { data: relatedBooks, error: relatedBooksError } = await admin
        .from("books")
        .select("*")
        .in("id", bookIds);

      if (relatedBooksError) {
        return NextResponse.json({ error: relatedBooksError.message }, { status: 500 });
      }

      for (const book of relatedBooks || []) {
        booksById.set(book.id, book);
      }
    }

    const attachBook = (order: OrderRow) => ({
      ...order,
      book: booksById.get(order.book_id) ?? null,
    });

    return NextResponse.json({
      ownedBooks: ownedBooks || [],
      ownerOrders: ((ownerOrders || []) as OrderRow[]).map(attachBook),
      borrowerOrders: ((borrowerOrders || []) as OrderRow[]).map(attachBook),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load manage books data",
      },
      { status: 500 }
    );
  }
}
