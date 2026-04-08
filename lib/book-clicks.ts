type TableError = {
  message?: string;
  code?: string;
};

function isMissingClicksTable(error: TableError | null | undefined) {
  if (!error) return false;

  return (
    error.code === "PGRST205" ||
    error.message?.includes("Could not find the table 'public.clicks'") ||
    error.message?.includes("clicks")
  );
}

export async function safeTrackBookClick(
  supabase: {
    from: (table: string) => {
      insert: (value: Record<string, unknown>) => PromiseLike<{ error: TableError | null }>;
    };
  },
  payload: {
    user_id: string;
    book_id: number;
    owner_id: string;
    source?: string;
  }
) {
  if (payload.user_id === payload.owner_id) {
    return;
  }

  const insertPayload: Record<string, unknown> = {
    user_id: payload.user_id,
    book_id: payload.book_id,
    owner_id: payload.owner_id,
  };

  if (payload.source) {
    insertPayload.source = payload.source;
  }

  const { error } = await supabase.from("clicks").insert(insertPayload);

  if (isMissingClicksTable(error)) {
    console.warn("clicks table is missing; skipping click tracking");
    return;
  }

  if (error) {
    console.error("Failed to track click:", error);
  }
}

export function isClicksTableMissing(error: TableError | null | undefined) {
  return isMissingClicksTable(error);
}
