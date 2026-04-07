"use client";

import { Book } from "@/lib/types";
import { Button } from "./ui/button";
import { X, User, Calendar, BookOpen } from "lucide-react";
import Image from "next/image";

interface BookDetailsModalProps {
  book: Book;
  onClose: () => void;
  onBorrow: (bookId: number) => void;
  onReturn: (bookId: number) => void;
}

export function BookDetailsModal({
  book,
  onClose,
  onBorrow,
  onReturn,
}: BookDetailsModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/80 hover:bg-background transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative h-64 md:h-80 w-full bg-muted">
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={`Cover of ${book.title}`}
              fill
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800">
              <BookOpen className="h-20 w-20 text-muted-foreground/30" />
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {book.title}
              </h2>
              <p className="text-lg text-muted-foreground mt-1">
                by {book.author}
              </p>
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium shrink-0 ${
                isAvailable
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
              }`}
            >
              {isAvailable ? "Available" : "Borrowed"}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <span className="px-3 py-1 rounded-full text-sm font-medium border border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950">
              {genreName}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Owner: {book.owner_name || "Unknown"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Added: {formatDate(book.created_at)}</span>
            </div>
          </div>

          {!isAvailable && book.current_borrower && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Currently borrowed by: <strong>{book.current_borrower}</strong>
              </p>
            </div>
          )}

          {book.description && (
            <div className="mt-6">
              <h3 className="font-semibold text-foreground mb-2">Description</h3>
              <p className="text-muted-foreground leading-relaxed">
                {book.description}
              </p>
            </div>
          )}

          <div className="mt-8 flex gap-3">
            {isAvailable ? (
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => onBorrow(book.id)}
              >
                Borrow This Book
              </Button>
            ) : (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onReturn(book.id)}
              >
                Return This Book
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
