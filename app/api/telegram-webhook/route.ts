import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const update = await request.json();

    const message = update.message || update.edited_message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId: number = message.from?.id;
    const username: string | undefined = message.from?.username;

    if (!chatId || !username) return NextResponse.json({ ok: true });

    const admin = createAdminClient();

    // Store chat_id when a registered user messages the bot
    await admin
      .from("tele_users")
      .update({ chat_id: chatId })
      .eq("telehandle", username);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true }); // always 200 so Telegram doesn't retry
  }
}
