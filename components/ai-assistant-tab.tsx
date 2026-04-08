"use client";

import { useState } from "react";
import { safeTrackBookClick } from "@/lib/book-clicks";
import { requestBorrow } from "@/lib/book-orders";
import { createClient } from "@/lib/supabase/client";
import { Book } from "@/lib/types";
import { resolveBookCoverUrls } from "@/lib/resolve-book-covers";
import { BookCard } from "./book-card";
import { BookDetailsModal } from "./book-details-modal";
import { Button } from "./ui/button";
import { Loader2, Sparkles } from "lucide-react";

interface AIAssistantTabProps {
  userId: string | null;
  userName: string | null;
}

export function AIAssistantTab({ userId, userName }: AIAssistantTabProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [recommendations, setRecommendations] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const supabase = createClient();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!query.trim()) {
      return;
    }

    setLoading(true);
    setAnswer("");
    setRecommendations([]);

    try {
      const response = await fetch("/api/ai-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Failed to get recommendations");
        return;
      }

      setAnswer(result.answer || "");
      setRecommendations(await resolveBookCoverUrls(result.recommendations || []));
    } catch (error) {
      console.error("Failed to fetch AI recommendations:", error);
      alert("Failed to get recommendations");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (book: Book) => {
    if (userId && book.owner_id) {
      await safeTrackBookClick(supabase, {
        user_id: userId,
        book_id: book.id,
        owner_id: book.owner_id,
        source: "ai_assistant",
      });
    }
    setSelectedBook(book);
  };

  const handleBorrow = async (bookId: number) => {
    if (!userId || !userName) {
      alert("Please sign in to borrow books");
      return;
    }

    const book = recommendations.find((item) => item.id === bookId);
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
  };

  const handleReturn = async (bookId: number) => {
    void bookId;
  };

  if (!userId || !userName) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
        Sign in to use the AI assistant and get personalized recommendations.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h2 className="text-xl font-bold">AI Library Assistant</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask for books by topic, reading level, purpose, or ministry need. The
          assistant searches book embeddings and avoids books you have already
          borrowed before.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Example: Recommend a devotional book on prayer that is easier to read."
            className="min-h-28 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Recommendations come from the stored book embeddings and current availability.
            </p>
            <Button
              type="submit"
              disabled={loading || !query.trim()}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Ask Assistant
            </Button>
          </div>
        </form>
      </section>

      {(answer || loading) && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recommendation Summary
          </h3>
          {loading ? (
            <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching embeddings and preparing recommendations...
            </div>
          ) : (
            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground">
              {answer}
            </div>
          )}
        </section>
      )}

      {recommendations.length > 0 && (
        <section>
          <h3 className="mb-5 text-lg font-bold">Suggested Books</h3>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                userId={userId}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        </section>
      )}

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
