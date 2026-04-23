export const BLOCKED_BOOK_COVER_HOSTS = new Set([
  "store.thegospelcoalition.org",
]);

export function normalizeBookCoverUrl(url: string) {
  return url.replace("http://", "https://").replace("&edge=curl", "");
}

export function isBlockedBookCoverUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_BOOK_COVER_HOSTS.has(hostname);
  } catch {
    return false;
  }
}
