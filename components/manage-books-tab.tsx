"use client";

import { useCallback, useEffect, useState } from "react";
import { currentBorrowerColumnMissing, updateBookBorrowState } from "@/lib/book-borrowing";
import { createClient } from "@/lib/supabase/client";
import { Book } from "@/lib/types";
import { resolveBookCoverUrls } from "@/lib/resolve-book-covers";
import { BookDetailsModal } from "./book-details-modal";
import { BookCoverImage } from "./book-cover-image";
import { Button } from "./ui/button";
import { Loader2, Trash2, User, BookOpen, Inbox } from "lucide-react";

interface ManageBooksTabProps {
  userId: string | null;
  userName: string | null;
}

export function ManageBooksTab({ userId, userName }: ManageBooksTabProps) {
  const [ownedBooks, setOwnedBooks] = useState<Book[]>([]);
  const [borrowedBooks, setBorrowedBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingBookId, setDeletingBookId] = useState<number | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [borrowerNamesAvailable, setBorrowerNamesAvailable] = useState(true);

  const supabase = createClient();

  const fetchBooks = useCallback(async () => {
    if (!userId || !userName) {
      setOwnedBooks([]);
      setBorrowedBooks([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: owned, error: ownedError } = await supabase
      .from("books")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (ownedError) {
      console.error("Failed to fetch owned books:", ownedError);
      setOwnedBooks([]);
    } else {
      setOwnedBooks(await resolveBookCoverUrls(owned || []));
    }

    const { data: borrowed, error: borrowedError } = await supabase
      .from("books")
      .select("*")
      .eq("current_borrower_id", userId)
      .neq("owner_id", userId)
      .order("updated_at", { ascending: false });

    if (currentBorrowerColumnMissing(borrowedError)) {
      setBorrowerNamesAvailable(false);
      setBorrowedBooks([]);
    } else if (borrowedError) {
      console.error("Failed to fetch borrowed books:", borrowedError);
      setBorrowedBooks([]);
    } else {
      setBorrowerNamesAvailable(true);
      setBorrowedBooks(await resolveBookCoverUrls(borrowed || []));
    }

    setLoading(false);
  }, [supabase, userId, userName]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleDeleteBook = async (bookId: number) => {
    const confirmed = window.confirm(
      "Delete this book from your library? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setDeletingBookId(bookId);

    try {
      const response = await fetch("/api/delete-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Failed to delete book");
        return;
      }

      setOwnedBooks((prev) => prev.filter((book) => book.id !== bookId));
    } catch (error) {
      console.error("Failed to delete book:", error);
      alert("Failed to delete book");
    } finally {
      setDeletingBookId(null);
    }
  };

  const handleBorrow = async (bookId: number) => {
    if (!userId || !userName) {
      alert("Please sign in to borrow books");
      return;
    }

    const { error } = await updateBookBorrowState(supabase, bookId, {
      status: false,
      currentBorrowerId: userId,
    });

    if (error) {
      alert("Failed to borrow book: " + error.message);
      return;
    }

    setSelectedBook(null);
    fetchBooks();
  };

  const handleReturn = async (bookId: number) => {
    const { error } = await updateBookBorrowState(supabase, bookId, {
      status: true,
      currentBorrowerId: null,
    });

    if (error) {
      alert("Failed to return book: " + error.message);
      return;
    }

    setSelectedBook(null);
    fetchBooks();
  };

  if (!userId || !userName) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
        Sign in to manage your books and borrowing activity.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold">Your Books</h2>
            <p className="text-sm text-muted-foreground">
              See who has borrowed your books and remove books that are back with you.
            </p>
          </div>
        </div>

        {ownedBooks.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
            You have not added any books yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {ownedBooks.map((book) => {
              const isAvailable = book.status === true;
              const isOwnedByViewer = book.owner_id === userId;

              return (
                <div
                  key={book.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="relative mx-auto aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:mx-0">
                      {book.cover_url ? (
                        <BookCoverImage
                          src={book.cover_url}
                          alt={`Cover of ${book.title}`}
                          className="object-contain"
                          sizes="96px"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                          <BookOpen className="h-8 w-8 opacity-40" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setSelectedBook(book)}
                          className="text-left text-lg font-semibold text-foreground hover:text-blue-600"
                        >
                          {book.title}
                        </button>
                        <p className="text-sm text-muted-foreground">by {book.author}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            isOwnedByViewer
                              ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              : isAvailable
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                          }`}
                        >
                          {isOwnedByViewer
                            ? "Owned"
                            : isAvailable
                              ? "Available with you"
                              : "Currently borrowed"}
                        </span>
                        {book.difficulty && (
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
                            {book.difficulty}
                          </span>
                        )}
                        {book.purpose && (
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
                            {book.purpose}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>
                          {isAvailable
                            ? "No one is currently borrowing this book."
                            : borrowerNamesAvailable
                              ? `Borrowed by ${book.current_borrower || "someone"}`
                              : "This book is currently marked as borrowed."}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-start">
                      <Button
                        variant="outline"
                        disabled={!isAvailable || deletingBookId === book.id}
                        onClick={() => handleDeleteBook(book.id)}
                        className="gap-2"
                      >
                        {deletingBookId === book.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-amber-500" />
          <div>
            <h2 className="text-xl font-bold">Books You Borrowed</h2>
            <p className="text-sm text-muted-foreground">
              See which books you currently have and who they belong to.
            </p>
          </div>
        </div>

        {borrowedBooks.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
            {borrowerNamesAvailable
              ? "You are not currently borrowing any books."
              : "Borrowed-book history is unavailable because your schema does not store the current borrower name."}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {borrowedBooks.map((book) => (
              <div
                key={book.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex gap-4">
                  <div className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {book.cover_url ? (
                      <BookCoverImage
                        src={book.cover_url}
                        alt={`Cover of ${book.title}`}
                        className="object-contain"
                        sizes="80px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        <BookOpen className="h-7 w-7 opacity-40" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setSelectedBook(book)}
                        className="text-left font-semibold text-foreground hover:text-blue-600"
                      >
                        {book.title}
                      </button>
                      <p className="text-sm text-muted-foreground">by {book.author}</p>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Owned by <span className="font-medium text-foreground">{book.owner_name || "Unknown owner"}</span>
                    </p>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReturn(book.id)}
                    >
                      Mark as Returned
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedBook && (
        <BookDetailsModal
          book={selectedBook}
          userId={userId}
          onClose={() => setSelectedBook(null)}
          onBorrow={handleBorrow}
          onReturn={handleReturn}
        />
      )}
    </div>
  );
}
