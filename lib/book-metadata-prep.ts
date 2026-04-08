import { tavily } from "@tavily/core";
import { generateBookMetadataPrompt } from "@/lib/prompts/book-metadata-prompt";

export interface CoverOption {
  imageUrl: string;
  source: string;
  title?: string;
}

export interface PreparedBookMetadataInput {
  prompt: string;
  bookInfoAnswer: string;
  difficultyAnswer: string;
  searchContent: string;
}

function normalizeImageUrl(url: string | undefined | null) {
  if (!url) return null;
  return url.replace("http://", "https://").replace("&edge=curl", "");
}

function dedupeCoverOptions(options: CoverOption[]) {
  const seen = new Set<string>();

  return options.filter((option) => {
    if (seen.has(option.imageUrl)) {
      return false;
    }
    seen.add(option.imageUrl);
    return true;
  });
}

export async function prepareBookMetadataInput(
  bookName: string,
  authorName: string
): Promise<{
  coverOptions: CoverOption[];
  preparedMetadata: PreparedBookMetadataInput;
}> {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error("Server configuration error: Missing Tavily API key");
  }

  const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });

  const [coverResult, bookInfoResult, difficultyResult] = await Promise.all([
    tavilyClient.search(`${bookName} by ${authorName} book cover`, {
      includeAnswer: "basic",
      searchDepth: "advanced",
      includeImages: true,
      maxResults: 4,
    }),
    tavilyClient.search(`${bookName} by ${authorName}`, {
      includeAnswer: "basic",
      searchDepth: "advanced",
      includeImages: false,
      includeRawContent: "text",
      maxResults: 2,
    }),
    tavilyClient.search(`${bookName} by ${authorName} reading difficulty`, {
      includeAnswer: "basic",
      searchDepth: "advanced",
      includeRawContent: "text",
      maxResults: 2,
    }),
  ]);

  const coverOptions = dedupeCoverOptions(
    (coverResult.images || [])
      .map((image) => {
        if (typeof image === "string") {
          const normalized = normalizeImageUrl(image);
          return normalized
            ? { imageUrl: normalized, source: "Tavily image result" }
            : null;
        }

        const imageRecord = image as {
          src?: string;
          url?: string;
          host?: string;
          title?: string;
        };

        const normalized =
          normalizeImageUrl(imageRecord.src) || normalizeImageUrl(imageRecord.url);

        if (!normalized) {
          return null;
        }

        return {
          imageUrl: normalized,
          source: imageRecord.host || imageRecord.title || "Tavily image result",
          title: imageRecord.title,
        };
      })
      .filter(Boolean) as CoverOption[]
  ).slice(0, 4);

  const searchContent = [bookInfoResult, difficultyResult]
    .flatMap((result) => result.results || [])
    .map((result) => result.content || result.rawContent || "")
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);

  const preparedMetadata = {
    bookInfoAnswer: bookInfoResult.answer || "",
    difficultyAnswer: difficultyResult.answer || "",
    searchContent,
    prompt: generateBookMetadataPrompt({
      bookName,
      authorName,
      bookInfoAnswer: bookInfoResult.answer || "",
      difficultyAnswer: difficultyResult.answer || "",
      searchContent,
    }),
  };

  return {
    coverOptions,
    preparedMetadata,
  };
}
