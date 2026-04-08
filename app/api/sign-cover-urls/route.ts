import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSupabaseStorageUrl } from "@/lib/book-cover-storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const urls = Array.isArray(body.urls) ? body.urls : [];

    if (urls.length === 0) {
      return NextResponse.json({ signedUrls: {} });
    }

    const supabase = createAdminClient();
    const signedUrls: Record<string, string> = {};

    await Promise.all(
      urls.map(async (url) => {
        if (typeof url !== "string" || !url) {
          return;
        }

        const parsed = parseSupabaseStorageUrl(url);
        if (!parsed) {
          signedUrls[url] = url;
          return;
        }

        const { data, error } = await supabase.storage
          .from(parsed.bucket)
          .createSignedUrl(parsed.objectPath, 60 * 60);

        if (!error && data?.signedUrl) {
          signedUrls[url] = data.signedUrl;
        } else {
          signedUrls[url] = url;
        }
      })
    );

    return NextResponse.json({ signedUrls });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to sign cover URLs",
      },
      { status: 500 }
    );
  }
}
