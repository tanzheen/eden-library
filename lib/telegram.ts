const APP_URL = "https://v0-church-book-exchange-gmlcwilf7jb.vercel.app/";

export async function sendTelegramMessage(chatId: number, text: string) {
  const token = process.env.BOT_TOKEN;
  if (!token) return;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("Telegram sendMessage failed:", err);
  }
}

export function borrowRequestMessage(borrowerName: string, bookTitle: string) {
  return (
    `📚 <b>${borrowerName}</b> wants to borrow your book "<b>${bookTitle}</b>".\n\n` +
    `Visit <a href="${APP_URL}">${APP_URL}</a> to approve or decline.`
  );
}

export function borrowApprovedMessage(ownerName: string, bookTitle: string) {
  return (
    `✅ Your request to borrow "<b>${bookTitle}</b>" has been approved by <b>${ownerName}</b>!\n\n` +
    `Visit <a href="${APP_URL}">${APP_URL}</a> to see your borrowed books.`
  );
}
