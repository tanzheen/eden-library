import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

  if (!BRAVE_API_KEY) {
    // Fallback: Use Google Books API to find cover images
    try {
      const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`;
      const response = await fetch(googleBooksUrl);
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const book = data.items[0];
        const imageLinks = book.volumeInfo?.imageLinks;

        if (imageLinks) {
          // Prefer larger images
          const imageUrl = imageLinks.extraLarge ||
                          imageLinks.large ||
                          imageLinks.medium ||
                          imageLinks.thumbnail ||
                          imageLinks.smallThumbnail;

          if (imageUrl) {
            // Convert to https and remove edge=curl parameter for cleaner images
            const cleanUrl = imageUrl.replace("http://", "https://").replace("&edge=curl", "");
            return NextResponse.json({ imageUrl: cleanUrl });
          }
        }
      }

      return NextResponse.json({ imageUrl: null });
    } catch (error) {
      console.error("Google Books API error:", error);
      return NextResponse.json({ imageUrl: null });
    }
  }

  // Use Brave Search API if key is available
  try {
    const braveUrl = `https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(query)}&count=1&safesearch=strict`;

    const response = await fetch(braveUrl, {
      headers: {
        "Accept": "application/json",
        "X-Subscription-Token": BRAVE_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const imageUrl = data.results[0].properties?.url || data.results[0].thumbnail?.src;
      return NextResponse.json({ imageUrl });
    }

    return NextResponse.json({ imageUrl: null });
  } catch (error) {
    console.error("Brave API error:", error);

    // Fallback to Google Books
    try {
      const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`;
      const response = await fetch(googleBooksUrl);
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const book = data.items[0];
        const imageLinks = book.volumeInfo?.imageLinks;

        if (imageLinks) {
          const imageUrl = imageLinks.extraLarge ||
                          imageLinks.large ||
                          imageLinks.medium ||
                          imageLinks.thumbnail;

          if (imageUrl) {
            const cleanUrl = imageUrl.replace("http://", "https://").replace("&edge=curl", "");
            return NextResponse.json({ imageUrl: cleanUrl });
          }
        }
      }
    } catch {
      // Ignore fallback errors
    }

    return NextResponse.json({ imageUrl: null });
  }
}
