"use client";

import { useCallback, useEffect, useState } from "react";
import { safeTrackBookClick } from "@/lib/book-clicks";
import { requestBorrow } from "@/lib/book-orders";
import { createClient } from "@/lib/supabase/client";
import { Book } from "@/lib/types";
import { resolveBookCoverUrls } from "@/lib/resolve-book-covers";
import { BookCard } from "./book-card";
import { BookDetailsModal } from "./book-details-modal";
import { Loader2, Clock } from "lucide-react";

interface HomeTabProps {
  userId: string | null;
  userName: string | null;
}

export function HomeTab({ userId, userName }: HomeTabProps) {
  const [latestBooks, setLatestBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const supabase = createClient();

  const fetchBooks = useCallback(async () => {
    setLoading(true);

    // Fetch latest books
    const { data: latest } = await supabase
      .from("books")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8);

    setLatestBooks(await resolveBookCoverUrls(latest || []));

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks, userId]);

  const handleViewDetails = async (book: Book) => {
    if (userId && book.owner_id) {
      await safeTrackBookClick(supabase, {
        user_id: userId,
        book_id: book.id,
        owner_id: book.owner_id,
        source: "home",
      });
    }
    setSelectedBook(book);
    fetchBooks();
  };

  const handleBorrow = async (bookId: number) => {
    if (!userId || !userName) {
      alert("Please sign in to borrow books");
      return;
    }

    const book = latestBooks.find((item) => item.id === bookId);
    if (book?.owner_id === userId) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Latest Books Section */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <Clock className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-bold">Latest Additions</h2>
        </div>
        {latestBooks.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {latestBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                userId={userId}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            No books in the library yet. Be the first to add one!
          </p>
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
