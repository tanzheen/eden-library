/**
 * Test script for book metadata generation
 *
 * Run with: npx tsx scripts/test-metadata.ts
 *
 * Options:
 *   --refresh    Force refresh Tavily results (ignore cache)
 *
 * Make sure you have TAVILY_API_KEY and GEMINI_API_KEY in your .env.local
 */

import { tavily } from "@tavily/core";
import { GoogleGenAI } from "@google/genai";
import { generateBookMetadataPrompt } from "../lib/prompts/book-metadata-prompt";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
import { config } from "dotenv";
config({ path: ".env.local" });

const CACHE_FILE = path.join(__dirname, "tavily-cache.json");

interface CachedResults {
  [key: string]: {
    bookInfoResult: any;
    difficultyResult: any;
    cachedAt: string;
  };
}

function loadCache(): CachedResults {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    }
  } catch (e) {
    console.log("Could not load cache, starting fresh");
  }
  return {};
}

function saveCache(cache: CachedResults): void {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function getCacheKey(bookName: string, authorName: string): string {
  return `${bookName}::${authorName}`.toLowerCase();
}

// Debug: Check if API keys are loaded
const tavilyKey = process.env.TAVILY_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

console.log("Tavily API Key:", tavilyKey ? `${tavilyKey.slice(0, 10)}...` : "NOT SET");
console.log("Gemini API Key:", geminiKey ? `${geminiKey.slice(0, 10)}...` : "NOT SET");

if (!tavilyKey || !geminiKey) {
  console.error("\n❌ Missing API keys in .env.local");
  process.exit(1);
}

const tavilyClient = tavily({ apiKey: tavilyKey });
const genai = new GoogleGenAI({ apiKey: geminiKey });

async function testMetadataGeneration(bookName: string, authorName: string, forceRefresh = false) {
  console.log(`\n📚 Testing metadata generation for: "${bookName}" by ${authorName}\n`);
  console.log("=".repeat(60));

  const timings: { step: string; duration: number }[] = [];
  const pipelineStart = Date.now();

  // Step 1: Search Tavily (or load from cache)
  const cache = loadCache();
  const cacheKey = getCacheKey(bookName, authorName);

  let bookInfoResult: any;
  let difficultyResult: any;

  const step1Start = Date.now();
  if (!forceRefresh && cache[cacheKey]) {
    console.log("\n📦 Step 1: Loading Tavily results from cache...\n");
    bookInfoResult = cache[cacheKey].bookInfoResult;
    difficultyResult = cache[cacheKey].difficultyResult;
    console.log(`(Cached at: ${cache[cacheKey].cachedAt})`);
  } else {
    console.log("\n🔍 Step 1: Searching Tavily...\n");

    [bookInfoResult, difficultyResult] = await Promise.all([
      tavilyClient.search(`${bookName} by ${authorName}`, {
        includeAnswer: "basic",
        searchDepth: "basic",
        includeImages: true,
        maxResults: 2,
      }),
      tavilyClient.search(`${bookName} by ${authorName} reading difficulty`, {
        includeAnswer: "basic",
        searchDepth: "basic",
        maxResults: 2,
      }),
    ]);

    // Save to cache
    cache[cacheKey] = {
      bookInfoResult,
      difficultyResult,
      cachedAt: new Date().toISOString(),
    };
    saveCache(cache);
    console.log("(Results saved to cache)");
  }
  timings.push({ step: "Tavily Search", duration: Date.now() - step1Start });

  console.log("\nBook Info Answer:", bookInfoResult.answer);
  console.log("\nDifficulty Answer:", difficultyResult.answer);

  // Get images
  const images = bookInfoResult.images || [];
  if (images.length > 0) {
    const firstImage = images[0];
    const imageUrl = typeof firstImage === "string" ? firstImage : firstImage?.url;
    console.log("\nFirst Image URL:", imageUrl);
  }

  // Step 2: Generate prompt
  console.log("\n📝 Step 2: Generating Gemini prompt...\n");

  const searchContent = bookInfoResult.results?.[0]?.content || "";

  const prompt = generateBookMetadataPrompt({
    bookName,
    authorName,
    bookInfoAnswer: bookInfoResult.answer || "",
    difficultyAnswer: difficultyResult.answer || "",
    searchContent,
  });

  console.log("Prompt length:", prompt.length, "characters");

  // Step 3: Call Gemini
  const metadataModel = "gemma-4-26b-a4b-it";
  console.log(`\n🤖 Step 3: Calling Gemini (${metadataModel})...\n`);

  const step3Start = Date.now();
  const response = await genai.models.generateContent({
    model: metadataModel,
    contents: prompt,
  });
  timings.push({ step: "Gemini Metadata", duration: Date.now() - step3Start });

  const responseText = response.text || "";
  console.log("Raw Gemini Response:", responseText);

  // Step 4: Parse response
  console.log("\n✅ Step 4: Parsed Metadata:\n");

  let description = "";
  try {
    const cleanedResponse = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const metadata = JSON.parse(cleanedResponse);
    console.log(JSON.stringify(metadata, null, 2));
    description = metadata.description || "";
  } catch (e) {
    console.error("Failed to parse response:", e);
  }

  // Step 5: Generate embedding
  if (description) {
    const embeddingModel = "gemini-embedding-001";
    console.log(`\n🧮 Step 5: Generating embedding (${embeddingModel})...\n`);

    const step5Start = Date.now();
    try {
      const embeddingResponse = await genai.models.embedContent({
        model: embeddingModel,
        contents: description,
      });

      const embedding = embeddingResponse.embeddings?.[0]?.values;
      if (embedding) {
        console.log(`Embedding dimensions: ${embedding.length}`);
        console.log(`First 5 values: [${embedding.slice(0, 5).join(", ")}...]`);
      } else {
        console.log("No embedding returned");
      }
    } catch (embeddingError) {
      console.error("Failed to generate embedding:", embeddingError);
    }
    timings.push({ step: "Embedding", duration: Date.now() - step5Start });
  }

  const totalDuration = Date.now() - pipelineStart;

  // Print timing summary
  console.log("\n⏱️  TIMING SUMMARY:");
  console.log("-".repeat(40));
  for (const t of timings) {
    console.log(`  ${t.step.padEnd(20)} ${(t.duration / 1000).toFixed(2)}s`);
  }
  console.log("-".repeat(40));
  console.log(`  ${"TOTAL".padEnd(20)} ${(totalDuration / 1000).toFixed(2)}s`);

  console.log("\n" + "=".repeat(60));
}

// Test with sample books
async function main() {
  const forceRefresh = process.argv.includes("--refresh");

  if (forceRefresh) {
    console.log("🔄 Force refresh mode - will fetch fresh Tavily results\n");
  }

  try {
    await testMetadataGeneration("Gentle and Lowly", "Dane Ortlund", forceRefresh);
    // Add more test cases:
    // await testMetadataGeneration("Mere Christianity", "C.S. Lewis", forceRefresh);
    // await testMetadataGeneration("The Pursuit of God", "A.W. Tozer", forceRefresh);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
