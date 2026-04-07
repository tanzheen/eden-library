"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Book } from "@/lib/types";
import { BookCard } from "./book-card";
import { BookDetailsModal } from "./book-details-modal";
import { Loader2, BookX } from "lucide-react";

interface BookListProps {
  refreshTrigger?: number;
}

export function BookList({ refreshTrigger }: BookListProps) {
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

    setBooks(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBooks();
  }, [refreshTrigger]);

  const handleBorrow = async (bookId: number) => {
    const borrowerName = prompt("Enter your name to borrow this book:");
    if (!borrowerName) return;

    const { error: updateError } = await supabase
      .from("books")
      .update({
        status: false,
        current_borrower: borrowerName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookId);

    if (updateError) {
      alert("Failed to borrow book: " + updateError.message);
      return;
    }

    setSelectedBook(null);
    fetchBooks();
  };

  const handleReturn = async (bookId: number) => {
    const { error: updateError } = await supabase
      .from("books")
      .update({
        status: true,
        current_borrower: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookId);

    if (updateError) {
      alert("Failed to return book: " + updateError.message);
      return;
    }

    setSelectedBook(null);
    fetchBooks();
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
            onViewDetails={handleViewDetails}
          />
        ))}
      </div>

      {selectedBook && (
        <BookDetailsModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onBorrow={handleBorrow}
          onReturn={handleReturn}
        />
      )}
    </>
  );
}
