"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Book, GENRE_TAGS } from "@/lib/types";
import { BookCard } from "./book-card";
import { BookDetailsModal } from "./book-details-modal";
import { AddBookForm } from "./add-book-form";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Autocomplete } from "./ui/autocomplete";
import { Loader2, Search, X, Filter } from "lucide-react";

interface CatalogueTabProps {
  userId: string | null;
  userName: string | null;
}

export function CatalogueTab({ userId, userName }: CatalogueTabProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [owners, setOwners] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const supabase = createClient();

  const fetchBooks = useCallback(async () => {
    setLoading(true);

    let query = supabase.from("books").select("*");

    // Apply text search if query exists
    if (searchQuery.trim()) {
      // Use Supabase text search (requires setting up full-text search)
      // Fallback to ilike search for now
      query = query.or(
        `title.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
      );
    }

    // Apply genre filter
    if (selectedGenre) {
      query = query.eq("genre_tag", selectedGenre);
    }

    // Apply owner filter
    if (selectedOwner) {
      query = query.eq("owner_name", selectedOwner);
    }

    // Apply availability filter
    if (availableOnly) {
      query = query.eq("status", true);
    }

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching books:", error);
    } else {
      setBooks(data || []);
    }

    setLoading(false);
  }, [searchQuery, selectedGenre, selectedOwner, availableOnly, supabase]);

  const fetchOwners = async () => {
    const { data } = await supabase
      .from("books")
      .select("owner_name")
      .not("owner_name", "is", null);

    if (data) {
      const uniqueOwners = [...new Set(data.map((d) => d.owner_name).filter(Boolean))] as string[];
      setOwners(uniqueOwners);
    }
  };

  useEffect(() => {
    fetchBooks();
    fetchOwners();
  }, [refreshTrigger]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchBooks();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, selectedGenre, selectedOwner, availableOnly, fetchBooks]);

  const trackInteraction = async (bookId: number, type: "click" | "borrow" | "return") => {
    if (!userId) return;

    await supabase.from("book_interactions").insert({
      user_id: userId,
      book_id: bookId,
      interaction_type: type,
    });
  };

  const handleViewDetails = async (book: Book) => {
    await trackInteraction(book.id, "click");
    setSelectedBook(book);
  };

  const handleBorrow = async (bookId: number) => {
    if (!userName) {
      alert("Please sign in to borrow books");
      return;
    }

    const { error } = await supabase
      .from("books")
      .update({
        status: false,
        current_borrower: userName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookId);

    if (error) {
      alert("Failed to borrow book: " + error.message);
      return;
    }

    await trackInteraction(bookId, "borrow");
    setSelectedBook(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleReturn = async (bookId: number) => {
    const { error } = await supabase
      .from("books")
      .update({
        status: true,
        current_borrower: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookId);

    if (error) {
      alert("Failed to return book: " + error.message);
      return;
    }

    await trackInteraction(bookId, "return");
    setSelectedBook(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedGenre("");
    setSelectedOwner("");
    setAvailableOnly(false);
  };

  const hasActiveFilters = searchQuery || selectedGenre || selectedOwner || availableOnly;

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Autocomplete
              placeholder="Search books by title or author..."
              value={searchQuery}
              onChange={setSearchQuery}
              onSelect={(book) => setSearchQuery(book.title)}
              searchField="all"
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">
                  !
                </span>
              )}
            </Button>
            <AddBookForm
              onBookAdded={() => setRefreshTrigger((prev) => prev + 1)}
              userId={userId}
              userName={userName}
            />
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Genre</label>
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="w-full h-9 px-3 py-1 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">All Genres</option>
                  {GENRE_TAGS.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Owner</label>
                <select
                  value={selectedOwner}
                  onChange={(e) => setSelectedOwner(e.target.value)}
                  className="w-full h-9 px-3 py-1 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">All Owners</option>
                  {owners.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Availability</label>
                <div className="flex items-center gap-2 h-9">
                  <input
                    type="checkbox"
                    id="availableOnly"
                    checked={availableOnly}
                    onChange={(e) => setAvailableOnly(e.target.checked)}
                    className="rounded border-input"
                  />
                  <label htmlFor="availableOnly" className="text-sm">
                    Available only
                  </label>
                </div>
              </div>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="h-3 w-3" />
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : books.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            {books.length} book{books.length !== 1 ? "s" : ""} found
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {hasActiveFilters
              ? "No books match your search criteria."
              : "No books in the library yet."}
          </p>
          {hasActiveFilters && (
            <Button variant="link" onClick={clearFilters} className="mt-2">
              Clear filters
            </Button>
          )}
        </div>
      )}

      {selectedBook && (
        <BookDetailsModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onBorrow={handleBorrow}
          onReturn={handleReturn}
        />
      )}
    </div>
  );
}
