import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, tool, stepCountIs, convertToModelMessages, embed } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const systemPrompt = `You are a knowledgeable and friendly librarian assistant for a Christian library.
Be friendly but also concise and to the point.

Before calling the searchBooks tool, you can optionally gather the following information if relevant:
1. **Reading difficulty** — Are they looking for something light and easy, a moderate read, or a dense and challenging book? (e.g. beach read vs literary fiction vs academic text)
2. **Purpose** — Why are they reading? (e.g. entertainment, personal growth, learning a skill, academic research, processing emotions, reading to a child)
Call the searchBooks tool especially if the user changes their mind about the difficulty or purpose of the book they are looking for.

Ask these naturally as part of a concise conversation. Do not ask both in one robotic list. Weave them in based on context. For example, if someone says "I want something like a C.S. Lewis book", you might ask "Are you looking for something easy to breeze through, or are you okay with something more complex?" before searching.
Bold the questions you ask by wrapping them in ** tags.
Once you have enough context (genre/theme + difficulty + purpose), call the searchBooks tool.
For general conversation (greetings, thanks, farewells), respond directly without calling any tools.
Filter the list of books returned by the searchBooks tool — do not invent titles.
Only recommend books that are relevant to the user's request.

When you recommend books from a search, ALWAYS end your message with exactly this format on a new line:
SELECTED_IDS: [id1, id2, id3]
where the IDs match the books you actually recommended. Do not include this line if you did not recommend any books.`;

/**
 * Generate an embedding for a query string using Google's gemini-embedding-001 model.
 * Returns a float array suitable for pgvector similarity search.
 */
async function embedQuery(query: string): Promise<number[]> {
  const { embedding } = await embed({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    value: query,
  });

  return embedding;
} 

export async function POST(req: Request) {
  const { messages: uiMessages } = await req.json();
  const supabase = await createClient();

  // Convert UI messages to model messages
  const messages = await convertToModelMessages(uiMessages);

  const result = streamText({
    model: google("gemma-4-26b-a4b-it"),
    system: systemPrompt,
    messages,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingLevel: 'minimal',
        }
      }
    },
    tools: {
      searchBooks: tool({
        description: "Search the library database for books similar to a query",
        inputSchema: z.object({
          query: z.string().describe("Natural language search query"),
        }),
        execute: async ({ query }) => {
          const embedding = await embedQuery(query);
          const { data, error } = await supabase.rpc("match_books", {
            query_embedding: embedding,
            match_threshold: 0.4,
            match_count: 10,
          });
          if (error) throw new Error(error.message);
          if (!data || data.length === 0) return data;

          // match_books may not return all columns (e.g. cover_url), so fetch
          // the full book rows and merge cover_url + any other missing fields.
          const ids = (data as { id: number }[]).map((b) => b.id);
          const { data: fullBooks } = await supabase
            .from("books")
            .select("id, cover_url, description, isbn, status, owner_id")
            .in("id", ids);

          if (!fullBooks) return data;

          const bookMap = new Map(fullBooks.map((b) => [b.id, b]));
          return (data as { id: number }[]).map((b) => ({
            ...b,
            ...(bookMap.get(b.id) ?? {}),
          }));
        },
      }),
    },
    stopWhen: stepCountIs(5),
    onFinish: async ({ text, toolCalls }) => {
      const usedSearch = toolCalls.some((t) => t.toolName === "searchBooks");
      const tag = deriveTag(usedSearch, text);
      console.log("Session tag:", tag);
    },
  });

  return result.toUIMessageStreamResponse();
}

function deriveTag(usedSearch: boolean, text: string): string {
  if (usedSearch) return "recommendation";
  const lowerText = text.toLowerCase();
  if (lowerText.includes("bye") || lowerText.includes("thank"))
    return "farewell";
  if (text.includes("?")) return "clarification";
  return "off_topic";
}
