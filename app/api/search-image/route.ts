import { NextResponse } from "next/server";
import { prepareBookMetadataInput } from "@/lib/book-metadata-prep";

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

  try {
    const result = await prepareBookMetadataInput(title, author);
    return NextResponse.json({
      images: result.coverOptions,
      preparedMetadata: result.preparedMetadata,
    });
  } catch (error) {
    console.error("Tavily cover search error:", error);
    return NextResponse.json(
      { error: "Failed to search Tavily for cover options" },
      { status: 500 }
    );
  }
}
