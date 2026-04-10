/**
 * Test script for AI Librarian chatbot tool calling
 *
 * Run with: npx tsx scripts/test-chatbot.ts
 *
 * Tests:
 *   1. Embedding generation (gemini-embedding-001)
 *   2. Chat without tool calling (greetings)
 *   3. Chat with tool calling (book search)
 *   4. Direct book search request
 *
 * Make sure you have GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
 * and SUPABASE_SERVICE_ROLE_KEY in your .env.local
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ThinkingLevel } from "@google/genai";
import { streamText, tool, stepCountIs, embed } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

const geminiKey = process.env.GEMINI_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("=".repeat(60));
console.log("🤖 AI Librarian Chatbot Test Suite");
console.log("=".repeat(60));
console.log("\nGemini API Key:", geminiKey ? `${geminiKey.slice(0, 10)}...` : "NOT SET");
console.log("Supabase URL:", supabaseUrl ? `${supabaseUrl.slice(0, 30)}...` : "NOT SET");
console.log("Supabase Key:", supabaseKey ? `${supabaseKey.slice(0, 10)}...` : "NOT SET");

if (!geminiKey) {
  console.error("\n❌ Missing GEMINI_API_KEY in .env.local");
  process.exit(1);
}
if (!supabaseUrl || !supabaseKey) {
  console.error("\n❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const google = createGoogleGenerativeAI({
  apiKey: geminiKey,
});

const supabase = createClient(supabaseUrl, supabaseKey);

// Model with minimal thinking for faster responses
const chatModel = google("gemma-4-26b-a4b-it");

async function searchBooks(query: string) {
  const { embedding } = await embed({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    value: query,
  });

  const { data, error } = await supabase.rpc("match_books", {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: 10,
  });

  if (error) throw new Error(`match_books RPC failed: ${error.message}`);
  return data;
}

const systemPrompt = `You are a knowledgeable and friendly librarian assistant for a Christian library.
Help users discover books they will love through natural conversation.

Before calling the searchBooks tool, you MUST gather the following information if not already provided:
1. **Reading difficulty** — Are they looking for something light and easy, a moderate read, or a dense and challenging book?
2. **Purpose** — Why are they reading? (e.g. entertainment, personal growth, learning a skill)

Ask these naturally as part of the conversation.
For general conversation (greetings, thanks, farewells), respond directly without calling any tools.
Only recommend books returned by the searchBooks tool — do not invent titles.
When you recommend books from a search, always end your message with exactly this format on a new line:
SELECTED_IDS: [id1, id2, id3]
where the IDs match the books you actually recommended.`;


interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details: string;
  toolCalled?: boolean;
  response?: string;
}

const results: TestResult[] = [];

/**
 * Test 1: Embedding Generation
 */
async function testEmbedding(): Promise<void> {
  console.log("\n" + "-".repeat(60));
  console.log("📊 Test 1: Embedding Generation (gemini-embedding-001)");
  console.log("-".repeat(60));

  const start = Date.now();
  const testQuery = "I want a book about prayer and spiritual growth";

  try {
    const { embedding } = await embed({
      model: google.textEmbeddingModel("gemini-embedding-001"),
      value: testQuery,
    });

    const duration = Date.now() - start;

    console.log(`\n✅ Embedding generated successfully`);
    console.log(`   Query: "${testQuery}"`);
    console.log(`   Dimensions: ${embedding.length}`);
    console.log(`   First 5 values: [${embedding.slice(0, 5).map((v) => v.toFixed(4)).join(", ")}...]`);
    console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);

    results.push({
      name: "Embedding Generation",
      passed: embedding.length > 0,
      duration,
      details: `Generated ${embedding.length}-dimensional embedding`,
    });
  } catch (error) {
    const duration = Date.now() - start;
    console.error("\n❌ Embedding generation failed:", error);
    results.push({
      name: "Embedding Generation",
      passed: false,
      duration,
      details: `Error: ${error}`,
    });
  }
}

/**
 * Test 2: Chat without tool calling (greeting)
 */
async function testGreeting(): Promise<void> {
  console.log("\n" + "-".repeat(60));
  console.log("💬 Test 2: Chat without Tool Calling (Greeting)");
  console.log("-".repeat(60));

  const start = Date.now();
  const userMessage = "Hello! How are you today?";

  console.log(`\n📤 User: "${userMessage}"`);

  let toolWasCalled = false;
  let fullResponse = "";

  try {
    const result = streamText({
      model: chatModel,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingLevel: 'minimal',
          }
        }
      },
      tools: {
        searchBooks: tool({
          description: "Search the library database for books",
          inputSchema: z.object({
            query: z.string().describe("Natural language search query"),
          }),
          execute: async ({ query }) => {
            console.log(`\n🔧 Tool called with query: "${query}"`);
            toolWasCalled = true;
            return await searchBooks(query);
          },
        }),
      },
      stopWhen: stepCountIs(3),
    });

    // Consume the stream
    for await (const chunk of result.textStream) {
      fullResponse += chunk;
    }

    const duration = Date.now() - start;

    console.log(`\n📥 Assistant: "${fullResponse.slice(0, 200)}${fullResponse.length > 200 ? "..." : ""}"`);
    console.log(`\n   Tool called: ${toolWasCalled ? "Yes ❌ (unexpected)" : "No ✅ (expected)"}`);
    console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);

    results.push({
      name: "Greeting (no tool)",
      passed: !toolWasCalled && fullResponse.length > 0,
      duration,
      details: toolWasCalled ? "Tool was called unexpectedly" : "Responded without tool call",
      toolCalled: toolWasCalled,
      response: fullResponse,
    });
  } catch (error) {
    const duration = Date.now() - start;
    console.error("\n❌ Chat failed:", error);
    results.push({
      name: "Greeting (no tool)",
      passed: false,
      duration,
      details: `Error: ${error}`,
    });
  }
}

/**
 * Test 3: Chat with tool calling (book recommendation)
 */
async function testBookSearch(): Promise<void> {
  console.log("\n" + "-".repeat(60));
  console.log("📚 Test 3: Chat with Tool Calling (Book Search)");
  console.log("-".repeat(60));

  const start = Date.now();

  // Simulate a multi-turn conversation where user provides context
  const messages = [
    { role: "user" as const, content: "I'm looking for a devotional book about knowing God better" },
    {
      role: "assistant" as const,
      content:
        "That sounds wonderful! To help me find the perfect book for you, could you tell me - are you looking for something light and easy to read, or are you okay with something more in-depth and challenging?",
    },
    { role: "user" as const, content: "Something easy to read, for personal reflection" },
  ];

  console.log("\n📤 Conversation:");
  for (const msg of messages) {
    console.log(`   ${msg.role === "user" ? "User" : "Assistant"}: "${msg.content.slice(0, 80)}..."`);
  }

  let toolWasCalled = false;
  let toolQuery = "";
  let fullResponse = "";

  try {
    const result = streamText({
      model: chatModel,
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
          description: "Search the library database for books",
          inputSchema: z.object({
            query: z.string().describe("Natural language search query"),
          }),
          execute: async ({ query }) => {
            console.log(`\n🔧 Tool called with query: "${query}"`);
            toolWasCalled = true;
            toolQuery = query;
            return await searchBooks(query);
          },
        }),
      },
      stopWhen: stepCountIs(3),
    });

    // Consume the stream
    for await (const chunk of result.textStream) {
      fullResponse += chunk;
    }

    const duration = Date.now() - start;

    console.log(`\n📥 Assistant: "${fullResponse.slice(0, 300)}${fullResponse.length > 300 ? "..." : ""}"`);
    console.log(`\n   Tool called: ${toolWasCalled ? "Yes ✅ (expected)" : "No ❌ (unexpected)"}`);
    if (toolQuery) {
      console.log(`   Search query: "${toolQuery}"`);
    }

    // Check if SELECTED_IDS is in the response
    const hasSelectedIds = fullResponse.includes("SELECTED_IDS:");
    console.log(`   SELECTED_IDS present: ${hasSelectedIds ? "Yes ✅" : "No ⚠️"}`);
    console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);

    results.push({
      name: "Book Search (with tool)",
      passed: toolWasCalled,
      duration,
      details: toolWasCalled
        ? `Tool called with query: "${toolQuery}"`
        : "Tool was not called (may need more conversation context)",
      toolCalled: toolWasCalled,
      response: fullResponse,
    });
  } catch (error) {
    const duration = Date.now() - start;
    console.error("\n❌ Chat failed:", error);
    results.push({
      name: "Book Search (with tool)",
      passed: false,
      duration,
      details: `Error: ${error}`,
    });
  }
}

/**
 * Test 4: Direct book search request
 */
async function testDirectSearch(): Promise<void> {
  console.log("\n" + "-".repeat(60));
  console.log("🎯 Test 4: Direct Book Search Request");
  console.log("-".repeat(60));

  const start = Date.now();

  // More direct request that should trigger tool
  const userMessage =
    "Search for easy devotional books about prayer. I want something for personal reflection, not too academic.";

  console.log(`\n📤 User: "${userMessage}"`);

  let toolWasCalled = false;
  let toolQuery = "";
  let fullResponse = "";

  try {
    const result = streamText({
      model: chatModel,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingLevel: 'minimal',
          }
        }
      },
      tools: {
        searchBooks: tool({
          description: "Search the library database for books",
          inputSchema: z.object({
            query: z.string().describe("Natural language search query"),
          }),
          execute: async ({ query }) => {
            console.log(`\n🔧 Tool called with query: "${query}"`);
            toolWasCalled = true;
            toolQuery = query;
            return await searchBooks(query);
          },
        }),
      },
      stopWhen: stepCountIs(3),
    });

    // Consume the stream
    for await (const chunk of result.textStream) {
      fullResponse += chunk;
    }

    const duration = Date.now() - start;

    console.log(`\n📥 Assistant: "${fullResponse.slice(0, 300)}${fullResponse.length > 300 ? "..." : ""}"`);
    console.log(`\n   Tool called: ${toolWasCalled ? "Yes ✅" : "No ❌"}`);
    if (toolQuery) {
      console.log(`   Search query: "${toolQuery}"`);
    }

    const hasSelectedIds = fullResponse.includes("SELECTED_IDS:");
    console.log(`   SELECTED_IDS present: ${hasSelectedIds ? "Yes ✅" : "No ⚠️"}`);
    console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);

    results.push({
      name: "Direct Search Request",
      passed: toolWasCalled,
      duration,
      details: toolWasCalled ? `Tool called with query: "${toolQuery}"` : "Tool was not called",
      toolCalled: toolWasCalled,
      response: fullResponse,
    });
  } catch (error) {
    const duration = Date.now() - start;
    console.error("\n❌ Chat failed:", error);
    results.push({
      name: "Direct Search Request",
      passed: false,
      duration,
      details: `Error: ${error}`,
    });
  }
}

/**
 * Print summary
 */
function printSummary(): void {
  console.log("\n" + "=".repeat(60));
  console.log("📋 TEST SUMMARY");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  for (const result of results) {
    const icon = result.passed ? "✅" : "❌";
    console.log(`\n${icon} ${result.name}`);
    console.log(`   Status: ${result.passed ? "PASSED" : "FAILED"}`);
    console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`   Details: ${result.details}`);
  }

  console.log("\n" + "-".repeat(60));
  console.log(`\n🏁 Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("\n🎉 All tests passed! Tool calling is working correctly.\n");
  } else {
    console.log("\n⚠️  Some tests failed. Check the details above.\n");
  }
}

/**
 * Main test runner
 */
async function main(): Promise<void> {
  try {
    await testEmbedding();
    await testGreeting();
    await testBookSearch();
    await testDirectSearch();
    printSummary();
  } catch (error) {
    console.error("\n💥 Test suite crashed:", error);
    process.exit(1);
  }
}

main();
