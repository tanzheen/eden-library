"use client";

import { useEffect, useState } from "react";
import { requestBorrow } from "@/lib/book-orders";
import { createClient } from "@/lib/supabase/client";
import { Book } from "@/lib/types";
import { resolveBookCoverUrls } from "@/lib/resolve-book-covers";
import { BookCard } from "./book-card";
import { BookDetailsModal } from "./book-details-modal";
import { Loader2, BookX } from "lucide-react";

interface BookListProps {
  refreshTrigger?: number;
  userId?: string | null;
}

export function BookList({ refreshTrigger, userId }: BookListProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const supabase = createClient();

  const fetchBooks = async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("books")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setBooks(await resolveBookCoverUrls(data || []));
    setLoading(false);
  };

  useEffect(() => {
    fetchBooks();
  }, [refreshTrigger]);

  const handleBorrow = async (bookId: number) => {
    const book = books.find((item) => item.id === bookId);
    if (userId && book?.owner_id === userId) {
      alert("You cannot borrow your own book");
      return;
    }

    const result = await requestBorrow(bookId);

    if (!result.ok) {
      alert(result.error);
      return;
    }

    alert("Borrow request sent");
    setSelectedBook(null);
    fetchBooks();
  };

  const handleReturn = async (bookId: number) => {
    void bookId;
  };

  const handleViewDetails = (book: Book) => {
    setSelectedBook(book);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Error loading books: {error}</p>
        <button
          onClick={fetchBooks}
          className="mt-4 text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="text-center py-12">
        <BookX className="h-12 w-12 mx-auto text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">
          No books in the library yet. Be the first to add one!
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            userId={userId || null}
            onViewDetails={handleViewDetails}
          />
        ))}
      </div>

      {selectedBook && (
        <BookDetailsModal
          book={selectedBook}
          userId={userId || null}
          onClose={() => setSelectedBook(null)}
          onBorrow={handleBorrow}
          onReturn={handleReturn}
        />
      )}
    </>
  );
}
