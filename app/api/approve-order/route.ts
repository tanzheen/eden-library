import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, book_id, owner_id, borrower_id, status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.owner_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (order.status !== "requested") {
      return NextResponse.json(
        { error: "Only requested orders can be approved" },
        { status: 400 }
      );
    }

    const { data: activeBorrow } = await admin
      .from("orders")
      .select("id")
      .eq("book_id", order.book_id)
      .eq("status", "borrowed")
      .maybeSingle();

    if (activeBorrow) {
      return NextResponse.json(
        { error: "This book is already borrowed" },
        { status: 400 }
      );
    }

    const { error: updateOrderError } = await admin
      .from("orders")
      .update({
        status: "borrowed",
        borrowed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateOrderError) {
      return NextResponse.json(
        { error: updateOrderError.message },
        { status: 500 }
      );
    }

    const { data: borrowerUser } = await admin.auth.admin.getUserById(order.borrower_id);
    const borrowerName =
      borrowerUser?.user?.user_metadata?.full_name ||
      borrowerUser?.user?.email ||
      null;

    const { error: updateBookError } = await admin
      .from("books")
      .update({
        status: false,
        current_borrower_id: order.borrower_id,
        current_borrower: borrowerName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.book_id);

    if (updateBookError) {
      return NextResponse.json(
        { error: updateBookError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to approve order",
      },
      { status: 500 }
    );
  }
}
