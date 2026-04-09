import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userIds } = await request.json();

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ names: {} });
  }

  const admin = createAdminClient();

  const results = await Promise.all(
    userIds.map(async (id: string) => {
      const { data } = await admin.auth.admin.getUserById(id);
      const name =
        data?.user?.user_metadata?.full_name || data?.user?.email || id;
      return [id, name] as const;
    })
  );

  return NextResponse.json({ names: Object.fromEntries(results) });
}
