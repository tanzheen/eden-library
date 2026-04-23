import { Book } from "@/lib/types";

export function getPreferredBookCoverUrl(book: Pick<Book, "cover_url" | "cover_url_downloaded">) {
  return book.cover_url_downloaded || book.cover_url || null;
}

export function getFallbackBookCoverUrl(book: Pick<Book, "cover_url" | "cover_url_downloaded">) {
  if (book.cover_url_downloaded && book.cover_url) {
    return book.cover_url;
  }

  return null;
}
