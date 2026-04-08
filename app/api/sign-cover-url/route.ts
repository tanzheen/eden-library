import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSupabaseStorageUrl } from "@/lib/book-cover-storage";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const parsed = parseSupabaseStorageUrl(url);

  if (!parsed) {
    return NextResponse.json({ signedUrl: url });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.objectPath, 60 * 60);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to sign cover URL",
      },
      { status: 500 }
    );
  }
}
