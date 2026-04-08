interface RecommendationPromptInput {
  userQuery: string;
  borrowedTitles: string[];
  candidateBooks: Array<{
    title: string;
    author: string;
    ownerName: string | null;
    genre: string | null;
    difficulty: string | null;
    purpose: string | null;
    description: string | null;
    similarity: number;
  }>;
}

export function generateBookRecommendationPrompt(
  input: RecommendationPromptInput
) {
  const borrowedSummary =
    input.borrowedTitles.length > 0
      ? input.borrowedTitles.join(", ")
      : "No previous borrowed books recorded.";

  const candidateSummary = input.candidateBooks
    .map(
      (book, index) =>
        `${index + 1}. ${book.title} by ${book.author}
Owner: ${book.ownerName || "Unknown"}
Genre: ${book.genre || "Unknown"}
Difficulty: ${book.difficulty || "Unknown"}
Purpose: ${book.purpose || "Unknown"}
Similarity Score: ${book.similarity.toFixed(4)}
Description: ${book.description || "No description available."}`
    )
    .join("\n\n");

  return `You are a Christian library recommendation assistant.

The user asked:
"${input.userQuery}"

Books this user has borrowed before:
${borrowedSummary}

The following candidate books were selected by embedding similarity and are all books the user has not borrowed before:

${candidateSummary}

Write a concise recommendation response that:
1. Recommends the best 3 books from the candidate list.
2. Explains why each recommendation matches the user's request.
3. Mentions the owner when useful.
4. Does not invent books outside the candidate list.
5. If the request is broad or ambiguous, say that briefly and still recommend the strongest matches.

Keep the tone practical and helpful.`;
}
