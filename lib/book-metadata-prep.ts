import { tavily } from "@tavily/core";
import { generateBookMetadataPrompt } from "@/lib/prompts/book-metadata-prompt";

export interface PreparedBookMetadataInput {
  prompt: string;
  bookInfoAnswer: string;
  difficultyAnswer: string;
  searchContent: string;
}

export async function prepareBookMetadataInput(
  bookName: string,
  authorName: string
): Promise<{
  preparedMetadata: PreparedBookMetadataInput;
}> {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error("Server configuration error: Missing Tavily API key");
  }

  const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });

  const [bookInfoResult, difficultyResult] = await Promise.all([
    tavilyClient.search(`${bookName} by ${authorName}`, {
      includeAnswer: "basic",
      searchDepth: "basic",
      includeImages: false,
      includeRawContent: "text",
      maxResults: 2,
    }),
    tavilyClient.search(`${bookName} by ${authorName} reading difficulty`, {
      includeAnswer: "basic",
      searchDepth: "basic",
      includeRawContent: "text",
      maxResults: 2,
    }),
  ]);

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
    preparedMetadata,
  };
}
