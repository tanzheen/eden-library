"use client";

import { Book } from "@/lib/types";
import { Button } from "./ui/button";
import { User, Calendar } from "lucide-react";
import Image from "next/image";

interface BookCardProps {
  book: Book;
  onViewDetails: (book: Book) => void;
}

export function BookCard({ book, onViewDetails }: BookCardProps) {
  const isAvailable = book.status === true;
  const genreName = book.genre_tag || "Uncategorized";

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow flex flex-col">
      <div className="relative h-56 w-full bg-muted">
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt={`Cover of ${book.title}`}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800">
            <span className="text-4xl text-muted-foreground/50">📖</span>
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-bold text-lg text-foreground leading-tight">
          {book.title}
        </h3>
        <p className="text-muted-foreground mt-1">by {book.author}</p>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-medium border border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950">
            {genreName}
          </span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              isAvailable
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
            }`}
          >
            {isAvailable ? "Available" : "Borrowed"}
          </span>
        </div>

        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>{book.owner_name || "Unknown Owner"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(book.created_at)}</span>
          </div>
        </div>

        {book.description && (
          <p className="mt-4 text-sm text-muted-foreground line-clamp-2 flex-1">
            {book.description}
          </p>
        )}

        {!book.description && <div className="flex-1" />}

        <Button
          className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => onViewDetails(book)}
        >
          View Details
        </Button>
      </div>
    </div>
  );
}
