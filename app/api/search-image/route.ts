import { NextResponse } from "next/server";

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

  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX_KEY;

  if (!apiKey || !cx) {
    return NextResponse.json(
      { error: "Server configuration error: Missing Google API keys" },
      { status: 500 }
    );
  }

  try {
    const query = `${title} ${author} book cover`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&searchType=image&num=8&imgType=photo`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error("Google Custom Search error:", data);
      return NextResponse.json(
        { error: data.error?.message || "Google image search failed" },
        { status: 500 }
      );
    }

    const images = (data.items || []).map((item: {
      link: string;
      displayLink?: string;
      title?: string;
    }) => ({
      imageUrl: item.link,
      source: item.displayLink || "Google Images",
      title: item.title,
    }));

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Google image search error:", error);
    return NextResponse.json(
      { error: "Failed to search for cover images" },
      { status: 500 }
    );
  }
}
