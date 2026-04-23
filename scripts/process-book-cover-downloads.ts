import { config } from "dotenv";
import { tavily } from "@tavily/core";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadImageToSupabase } from "@/lib/book-cover-storage";
import { isSupabaseStorageUrl } from "@/lib/book-cover-storage";

config({ path: ".env.local" });

type BookRow = {
  id: number;
  title: string;
  author: string;
  cover_url: string | null;
  cover_url_downloaded: string | null;
};

const TARGET_TITLES = new Set([
  "be still",
  "have no fear",
  "is easter unbelievable",
  "revolutionary worship",
  "exodus old and new",
  "revolutionary work",
  "why should we love the local church?",
  "breathtaking glory",
  "willing but weak",
  "teaching james",
]);

const BLOCKED_IMAGE_HOSTS = new Set(["store.thegospelcoalition.org"]);

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    overwrite: args.has("--overwrite"),
    dryRun: args.has("--dry-run"),
    onlyTargets: args.has("--only-targets"),
  };
}

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isBlockedImageHost(url: string) {
  const hostname = getHostname(url);
  return hostname ? BLOCKED_IMAGE_HOSTS.has(hostname) : false;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getImageExtensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".png")) return "png";
    if (pathname.endsWith(".webp")) return "webp";
    if (pathname.endsWith(".gif")) return "gif";
    if (pathname.endsWith(".svg")) return "svg";
  } catch {
    // Ignore parse errors and let content-type detection handle it later.
  }

  return "jpg";
}

async function validateImageUrl(url: string) {
  if (isBlockedImageHost(url)) {
    return false;
  }

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; EdenLibraryCoverBot/1.0)",
      },
    });

    if (!response.ok) {
      return false;
    }

    const contentType = response.headers.get("content-type") || "";
    return contentType.startsWith("image/");
  } catch {
    return false;
  }
}

async function searchTavilyCover(
  tavilyClient: ReturnType<typeof tavily>,
  book: Pick<BookRow, "title" | "author">
) {
  const result = await tavilyClient.search(`${book.title} ${book.author} book cover`, {
    searchDepth: "basic",
    includeImages: true,
    includeAnswer: false,
    maxResults: 8,
  });

  const seen = new Set<string>();

  for (const image of result.images || []) {
    const rawUrl =
      typeof image === "string"
        ? image
        : image.src || image.url || null;

    if (!rawUrl) {
      continue;
    }

    const imageUrl = rawUrl.replace("http://", "https://").replace("&edge=curl", "");

    if (seen.has(imageUrl)) {
      continue;
    }
    seen.add(imageUrl);

    if (isBlockedImageHost(imageUrl)) {
      continue;
    }

    if (await validateImageUrl(imageUrl)) {
      return imageUrl;
    }
  }

  return null;
}

async function ensureDownloadedCover(
  book: BookRow,
  tavilyClient: ReturnType<typeof tavily> | null,
  dryRun: boolean
) {
  const shouldForceSearch = TARGET_TITLES.has(normalizeTitle(book.title));
  let sourceUrl: string | null = null;

  if (shouldForceSearch) {
    if (!tavilyClient) {
      throw new Error(
        `TAVILY_API_KEY is required to re-search cover for targeted title "${book.title}".`
      );
    }

    sourceUrl = await searchTavilyCover(tavilyClient, book);
    if (!sourceUrl) {
      throw new Error(`No Tavily image found for "${book.title}" by ${book.author}`);
    }
  } else if (book.cover_url_downloaded && isSupabaseStorageUrl(book.cover_url_downloaded)) {
    sourceUrl = book.cover_url_downloaded;
  } else if (book.cover_url && (await validateImageUrl(book.cover_url))) {
    sourceUrl = book.cover_url;
  } else if (tavilyClient) {
    sourceUrl = await searchTavilyCover(tavilyClient, book);
  }

  if (!sourceUrl) {
    throw new Error(`No usable cover source found for "${book.title}" by ${book.author}`);
  }

  if (dryRun) {
    return {
      uploadedUrl: `dry-run://images/book-covers/${book.id}.${getImageExtensionFromUrl(sourceUrl)}`,
      sourceUrl,
      shouldUpdateOriginalCover: shouldForceSearch,
    };
  }

  if (isSupabaseStorageUrl(sourceUrl)) {
    return {
      uploadedUrl: sourceUrl,
      sourceUrl,
      shouldUpdateOriginalCover: shouldForceSearch,
    };
  }

  const uploadedUrl = await uploadImageToSupabase(sourceUrl, book.id);
  return {
    uploadedUrl,
    sourceUrl,
    shouldUpdateOriginalCover: shouldForceSearch,
  };
}

async function main() {
  const { overwrite, dryRun, onlyTargets } = parseArgs();
  const supabase = createAdminClient();
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  const tavilyClient = tavilyApiKey ? tavily({ apiKey: tavilyApiKey }) : null;

  const { data: books, error } = await supabase
    .from("books")
    .select("id, title, author, cover_url, cover_url_downloaded")
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  if (!books) {
    console.log("No books found.");
    return;
  }

  const candidates = (books as BookRow[]).filter((book) => {
    if (onlyTargets && !TARGET_TITLES.has(normalizeTitle(book.title))) {
      return false;
    }

    if (!overwrite && book.cover_url_downloaded) {
      return false;
    }

    return true;
  });

  console.log(
    `Processing ${candidates.length} of ${books.length} books` +
      (dryRun ? " (dry run)" : "")
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const book of candidates) {
    try {
      const { uploadedUrl, sourceUrl, shouldUpdateOriginalCover } =
        await ensureDownloadedCover(
        book,
        tavilyClient,
        dryRun
        );

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from("books")
          .update(
            shouldUpdateOriginalCover
              ? {
                  cover_url: sourceUrl,
                  cover_url_downloaded: uploadedUrl,
                }
              : { cover_url_downloaded: uploadedUrl }
          )
          .eq("id", book.id);

        if (updateError) {
          throw new Error(updateError.message);
        }
      }

      updated += 1;
      console.log(
        `OK [${book.id}] ${book.title} -> ${uploadedUrl} (source: ${sourceUrl})`
      );
    } catch (error) {
      failed += 1;
      console.error(
        `FAIL [${book.id}] ${book.title}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    await delay(250);
  }

  skipped = books.length - candidates.length;
  console.log(`Done. Updated: ${updated}, Failed: ${failed}, Skipped: ${skipped}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
