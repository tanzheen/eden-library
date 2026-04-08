import { NextResponse } from "next/server";
import { tavily } from "@tavily/core";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const author = searchParams.get("author");

  if (!title || !author) {
    return NextResponse.json(
      { error: "Title and author are required" },
      { status: 400 }
    );
  }

  if (!process.env.TAVILY_API_KEY) {
    return NextResponse.json(
      { error: "Server configuration error: Missing Tavily API key" },
      { status: 500 }
    );
  }

  try {
    const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });

    const result = await tavilyClient.search(
      `${title} by ${author} book cover`,
      {
        searchDepth: "basic",
        includeImages: true,
        includeAnswer: false,
        maxResults: 5,
      }
    );

    const seen = new Set<string>();
    const images = (result.images || [])
      .map((image) => {
        const raw = typeof image === "string" ? image : (image as { src?: string; url?: string; host?: string; title?: string }).src || (image as { url?: string }).url;
        const imageUrl = raw?.replace("http://", "https://").replace("&edge=curl", "");
        if (!imageUrl) return null;

        const record = typeof image === "object" ? image as { host?: string; title?: string } : null;
        return {
          imageUrl,
          source: record?.host || record?.title || "Tavily",
          title: record?.title,
        };
      })
      .filter((item): item is NonNullable<typeof item> => {
        if (!item) return false;
        if (seen.has(item.imageUrl)) return false;
        seen.add(item.imageUrl);
        return true;
      })
      .slice(0, 6);

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Tavily image search error:", error);
    return NextResponse.json(
      { error: "Failed to search for cover images" },
      { status: 500 }
    );
  }
}
