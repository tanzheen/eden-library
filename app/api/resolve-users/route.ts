import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  // Query auth.users directly using the auth schema
  const adminAuthClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "auth" },
  });

  const { data: users, error } = await adminAuthClient
    .from("users")
    .select("id, email, raw_user_meta_data")
    .in("id", userIds);

  if (error) {
    console.error("resolve-users error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const names: Record<string, string> = {};
  for (const u of users ?? []) {
    names[u.id] =
      u.raw_user_meta_data?.full_name ||
      u.raw_user_meta_data?.name ||
      u.email ||
      u.id;
  }

  return NextResponse.json({ names });
}
