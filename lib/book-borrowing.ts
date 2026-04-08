type SupabaseLikeClient = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: number) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

function isMissingCurrentBorrowerColumn(error: { message?: string } | null | undefined) {
  return Boolean(
    error?.message?.includes("column books.current_borrower does not exist") ||
      error?.message?.includes("column books.current_borrower_id does not exist") ||
      error?.message?.includes("current_borrower")
  );
}

export async function updateBookBorrowState(
  supabase: SupabaseLikeClient,
  bookId: number,
  updates: {
    status: boolean;
    currentBorrowerId?: string | null;
  }
) {
  const baseUpdate = {
    status: updates.status,
    updated_at: new Date().toISOString(),
  };

  const fullUpdate = {
    ...baseUpdate,
    current_borrower_id:
      updates.currentBorrowerId === undefined ? null : updates.currentBorrowerId,
  };

  const result = await supabase.from("books").update(fullUpdate).eq("id", bookId);

  if (!isMissingCurrentBorrowerColumn(result.error)) {
    return result;
  }

  return supabase.from("books").update(baseUpdate).eq("id", bookId);
}

export function currentBorrowerColumnMissing(error: { message?: string } | null | undefined) {
  return isMissingCurrentBorrowerColumn(error);
}
