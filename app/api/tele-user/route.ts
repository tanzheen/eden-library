import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TELEHANDLE_PATTERN = /^[A-Za-z0-9_]{3,32}$/;

function normalizeTelehandle(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim().replace(/^@+/, "");

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue;
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const telehandle = normalizeTelehandle(body?.telehandle);

  if (!telehandle) {
    return NextResponse.json(
      { error: "Telehandle is required" },
      { status: 400 }
    );
  }

  if (!TELEHANDLE_PATTERN.test(telehandle)) {
    return NextResponse.json(
      {
        error:
          "Telehandle must be 3 to 32 characters and contain only letters, numbers, or underscores",
      },
      { status: 400 }
    );
  }

  let adminClient;

  try {
    adminClient = createAdminClient();
  } catch (error) {
    console.error("Admin client error:", error);
    return NextResponse.json(
      { error: "Failed to create admin client" },
      { status: 500 }
    );
  }

  const { data, error } = await adminClient
    .from("tele_users")
    .upsert(
      {
        owner_id: user.id,
        telehandle,
      },
      {
        onConflict: "owner_id",
      }
    )
    .select("owner_id, telehandle")
    .single();

  if (error) {
    console.error("Failed to upsert telehandle:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    teleUser: {
      owner_id: data.owner_id,
      telehandle: data.telehandle,
    },
  });
}
