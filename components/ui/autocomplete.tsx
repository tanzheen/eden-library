"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "./input";
import { createClient } from "@/lib/supabase/client";

export interface BookSuggestion {
  id: number;
  title: string;
  author: string;
  cover_url?: string | null;
  genre_tag?: string | null;
  difficulty?: string | null;
  purpose?: string | null;
  description?: string | null;
  embedding?: number[] | null;
  isbn?: string | null;
}

interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (book: BookSuggestion) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  searchField?: "title" | "all"; // 'title' for add form, 'all' for search
}

export function Autocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  id,
  className,
  searchField = "title",
}: AutocompleteProps) {
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Fetch suggestions when value changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);

      let query = supabase
        .from("books")
        .select("id, title, author, cover_url, genre_tag, difficulty, purpose, description, embedding, isbn");

      if (searchField === "title") {
        query = query.ilike("title", `%${value}%`);
      } else {
        query = query.or(
          `title.ilike.%${value}%,author.ilike.%${value}%`
        );
      }

      const { data, error } = await query
        .order("title")
        .limit(5);

      if (!error && data) {
        // Deduplicate by title + author
        const seen = new Set<string>();
        const unique = data.filter((book) => {
          const key = `${book.title.toLowerCase()}::${book.author.toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setSuggestions(unique);
      }

      setLoading(false);
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [value, searchField, supabase]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (book: BookSuggestion) => {
    onChange(book.title);
    setShowSuggestions(false);
    if (onSelect) {
      onSelect(book);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => handleSelect(book)}
              className="w-full px-3 py-2 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0"
            >
              <div className="font-medium text-sm truncate">{book.title}</div>
              <div className="text-xs text-muted-foreground truncate">
                by {book.author}
              </div>
            </button>
          ))}
        </div>
      )}

      {showSuggestions && loading && value.trim().length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
          Searching...
        </div>
      )}
    </div>
  );
}
