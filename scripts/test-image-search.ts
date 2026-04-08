/**
 * Test script for Tavily image search (book covers)
 *
 * Run with: npx tsx scripts/test-image-search.ts
 *
 * Make sure you have TAVILY_API_KEY in your .env.local
 */

import { tavily } from "@tavily/core";
import { config } from "dotenv";
config({ path: ".env.local" });

const apiKey = process.env.TAVILY_API_KEY;

console.log("TAVILY_API_KEY:", apiKey ? `${apiKey.slice(0, 10)}...` : "NOT SET");

if (!apiKey) {
  console.error("\n❌ Missing TAVILY_API_KEY in .env.local");
  process.exit(1);
}

async function searchBookCover(title: string, author: string) {
  console.log(`\n📚 Searching covers for: "${title}" by ${author}`);
  console.log("=".repeat(60));

  const tavilyClient = tavily({ apiKey: apiKey! });

  const start = Date.now();
  const result = await tavilyClient.search(
    `${title} by ${author} book cover`,
    {
      searchDepth: "basic",
      includeImages: true,
      includeAnswer: false,
      maxResults: 5,
    }
  );
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  const images = result.images || [];
  console.log(`\n✅ Found ${images.length} images in ${elapsed}s\n`);

  images.forEach((image, i) => {
    if (typeof image === "string") {
      console.log(`[${i + 1}] ${image}`);
    } else {
      const img = image as { src?: string; url?: string; host?: string; title?: string };
      console.log(`[${i + 1}] ${img.title || "(no title)"}`);
      console.log(`    Source: ${img.host || "(unknown)"}`);
      console.log(`    URL:    ${img.src || img.url}`);
    }
    console.log();
  });
}

async function main() {
  try {
    await searchBookCover("Gentle and Lowly", "Dane Ortlund");
    // await searchBookCover("Mere Christianity", "C.S. Lewis");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
