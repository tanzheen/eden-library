import { Bot } from "grammy";

const APP_URL = "https://v0-church-book-exchange-gmlcwilf7jb.vercel.app/";

function getBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;
  return new Bot(token);
}

export async function sendTelegramMessage(chatId: number, text: string) {
  const bot = getBot();
  if (!bot) return;

  try {
    await bot.api.sendMessage(chatId, text, { parse_mode: "HTML" });
  } catch (err) {
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
