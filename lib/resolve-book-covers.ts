import { Book } from "@/lib/types";

const COVER_URL_CACHE_KEY = "eden-library-cover-url-cache";
const COVER_URL_TTL_MS = 45 * 60 * 1000;
const coverUrlCache = new Map<string, { resolvedUrl: string; expiresAt: number }>();

function isBrowser() {
  return typeof window !== "undefined";
}

function getCachedCoverUrl(url: string) {
  const cached = coverUrlCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.resolvedUrl;
  }

  if (cached) {
    coverUrlCache.delete(url);
  }

  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(COVER_URL_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Record<
      string,
      { resolvedUrl: string; expiresAt: number }
    >;
    const stored = parsed[url];

    if (!stored || stored.expiresAt <= Date.now()) {
      return null;
    }

    coverUrlCache.set(url, stored);
    return stored.resolvedUrl;
  } catch {
    return null;
  }
}

function cacheCoverUrl(url: string, resolvedUrl: string) {
  const entry = {
    resolvedUrl,
    expiresAt: Date.now() + COVER_URL_TTL_MS,
  };

  coverUrlCache.set(url, entry);

  if (!isBrowser()) {
    return;
  }

  try {
    const raw = window.sessionStorage.getItem(COVER_URL_CACHE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Record<string, { resolvedUrl: string; expiresAt: number }>)
      : {};

    parsed[url] = entry;

    for (const [key, value] of Object.entries(parsed)) {
      if (value.expiresAt <= Date.now()) {
        delete parsed[key];
      }
    }

    window.sessionStorage.setItem(COVER_URL_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage errors and rely on in-memory cache.
  }
}

function preloadCoverImages(urls: string[]) {
  if (!isBrowser()) {
    return;
  }

  urls.slice(0, 6).forEach((url) => {
    const image = new window.Image();
    image.src = url;
  });
}

export async function resolveBookCoverUrls<T extends Book>(books: T[]) {
  const urls = [
    ...new Set(
      books
        .map((book) => book.cover_url)
        .filter((url): url is string => Boolean(url))
        .filter((url) => url.includes("/storage/v1/object/public/"))
    ),
  ];

  if (urls.length === 0) {
    preloadCoverImages(
      books
        .map((book) => book.cover_url)
        .filter((url): url is string => Boolean(url))
    );
    return books;
  }

  const cachedUrls: Record<string, string> = {};
  const uncachedUrls = urls.filter((url) => {
    const cached = getCachedCoverUrl(url);
    if (cached) {
      cachedUrls[url] = cached;
      return false;
    }
    return true;
  });

  try {
    let signedUrls = cachedUrls;

    if (uncachedUrls.length > 0) {
      const response = await fetch("/api/sign-cover-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: uncachedUrls }),
      });

      if (!response.ok) {
        return books;
      }

      const data = await response.json();
      const fetchedSignedUrls = (data.signedUrls || {}) as Record<string, string>;

      for (const [originalUrl, resolvedUrl] of Object.entries(fetchedSignedUrls)) {
        cacheCoverUrl(originalUrl, resolvedUrl);
      }

      signedUrls = {
        ...cachedUrls,
        ...fetchedSignedUrls,
      };
    }

    const resolvedBooks = books.map((book) => ({
      ...book,
      cover_url:
        book.cover_url && signedUrls[book.cover_url]
          ? signedUrls[book.cover_url]
          : book.cover_url,
    }));

    preloadCoverImages(
      resolvedBooks
        .map((book) => book.cover_url)
        .filter((url): url is string => Boolean(url))
    );

    return resolvedBooks;
  } catch {
    return books;
  }
}
