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

    if (order.borrower_id !== user.id && order.owner_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (order.status !== "borrowed") {
      return NextResponse.json(
        { error: "Only borrowed orders can be returned" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { error: updateOrderError } = await admin
      .from("orders")
      .update({
        status: "returned",
        returned_at: now,
        updated_at: now,
      })
      .eq("id", order.id);

    if (updateOrderError) {
      return NextResponse.json(
        { error: updateOrderError.message },
        { status: 500 }
      );
    }

    const { error: updateBookError } = await admin
      .from("books")
      .update({
        status: true,
        current_borrower_id: null,
        updated_at: now,
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
          error instanceof Error ? error.message : "Failed to return order",
      },
      { status: 500 }
    );
  }
}
