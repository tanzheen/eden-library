import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTelegramMessage, borrowRequestMessage } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { bookId } = await request.json();

    if (!bookId) {
      return NextResponse.json({ error: "Book ID is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: book, error: bookError } = await admin
      .from("books")
      .select("id, owner_id, status, title")
      .eq("id", bookId)
      .single();

    if (bookError || !book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (book.owner_id === user.id) {
      return NextResponse.json(
        { error: "You cannot borrow your own book" },
        { status: 400 }
      );
    }

    if (book.status !== true) {
      return NextResponse.json(
        { error: "This book is not currently available" },
        { status: 400 }
      );
    }

    const { data: existingOrder } = await admin
      .from("orders")
      .select("id, status")
      .eq("book_id", bookId)
      .eq("borrower_id", user.id)
      .in("status", ["requested", "borrowed"])
      .maybeSingle();

    if (existingOrder) {
      return NextResponse.json(
        { error: "You already have an active request or borrow for this book" },
        { status: 400 }
      );
    }

    // Fetch borrower and owner names
    const [{ data: borrowerAuth }, { data: ownerAuth }] = await Promise.all([
      admin.auth.admin.getUserById(user.id),
      admin.auth.admin.getUserById(book.owner_id),
    ]);

    const borrowerName =
      borrowerAuth?.user?.user_metadata?.full_name ||
      borrowerAuth?.user?.email ||
      null;

    const ownerName =
      ownerAuth?.user?.user_metadata?.full_name ||
      ownerAuth?.user?.email ||
      null;

    const { data: createdOrder, error: createError } = await admin
      .from("orders")
      .insert({
        book_id: bookId,
        owner_id: book.owner_id,
        borrower_id: user.id,
        owner_name: ownerName,
        borrower_name: borrowerName,
        status: "requested",
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Notify the owner via Telegram (best-effort)
    try {
      const { data: teleUser } = await admin
        .from("tele_users")
        .select("chat_id")
        .eq("owner_id", book.owner_id)
        .maybeSingle();

      if (teleUser?.chat_id) {
        await sendTelegramMessage(
          teleUser.chat_id,
          borrowRequestMessage(borrowerName || "Someone", book.title)
        );
      }
    } catch (notifyErr) {
      console.error("Failed to send borrow request notification:", notifyErr);
    }

    return NextResponse.json({ order: createdOrder });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to request borrow",
      },
      { status: 500 }
    );
  }
}
