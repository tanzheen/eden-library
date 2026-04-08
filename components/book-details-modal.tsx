"use client";

import { Book } from "@/lib/types";
import { Button } from "./ui/button";
import { X, User, BookOpen } from "lucide-react";
import { BookCoverImage } from "./book-cover-image";

interface BookDetailsModalProps {
  book: Book;
  userId?: string | null;
  copies?: Book[];
  canReturn?: boolean;
  onClose: () => void;
  onBorrow: (bookId: number) => void;
  onReturn: (bookId: number) => void;
}

export function BookDetailsModal({
  book,
  userId,
  copies,
  canReturn = false,
  onClose,
  onBorrow,
  onReturn,
}: BookDetailsModalProps) {
  const isAvailable = book.status === true;
  const isOwnedByViewer = Boolean(userId && book.owner_id === userId);
  const tags = [book.genre_tag, book.difficulty, book.purpose].filter(
    Boolean
  ) as string[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-card shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/80 hover:bg-background transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6">
          <div className="flex flex-col gap-8 md:flex-row md:items-start">
            <div className="mx-auto w-full max-w-[180px] shrink-0 md:mx-0 md:max-w-[220px]">
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-muted shadow-md">
                {book.cover_url ? (
                  <BookCoverImage
                    src={book.cover_url}
                    alt={`Cover of ${book.title}`}
                    className="object-contain"
                    sizes="(max-width: 768px) 180px, 220px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800">
                    <BookOpen className="h-16 w-16 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold leading-tight text-foreground">
                    {book.title}
                  </h2>
                  <p className="text-lg text-muted-foreground">by {book.author}</p>
                </div>
                <span
                  className={`inline-flex rounded-full px-4 py-2 text-sm font-medium shrink-0 ${
                    isOwnedByViewer
                      ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      : isAvailable
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                  }`}
                >
                  {isOwnedByViewer ? "Owned" : isAvailable ? "Available" : "Borrowed"}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Owner: {book.owner_name || "Unknown"}</span>
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {!isAvailable && book.current_borrower && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Currently borrowed by: <strong>{book.current_borrower}</strong>
                  </p>
                </div>
              )}

              {copies && copies.length > 1 && (
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">
                    Available Copies
                  </h3>
                  <div className="space-y-3">
                    {copies.map((copy) => {
                      const ownedByViewer = Boolean(userId && copy.owner_id === userId);
                      const copyAvailable = copy.status === true;

                      return (
                        <div
                          key={copy.id}
                          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {copy.owner_name || "Unknown owner"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {ownedByViewer
                                ? "This is your copy."
                                : copyAvailable
                                  ? "Available to borrow"
                                  : "Currently borrowed"}
                            </p>
                          </div>
                          {ownedByViewer ? (
                            <Button variant="outline" size="sm" disabled>
                              Owned
                            </Button>
                          ) : copyAvailable ? (
                            <Button size="sm" onClick={() => onBorrow(copy.id)}>
                              Borrow This Copy
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled>
                              Unavailable
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {book.description && (
            <div className="mt-8 border-t border-border pt-6">
              <h3 className="font-semibold text-foreground mb-2">Description</h3>
              <p className="text-muted-foreground leading-relaxed">
                {book.description}
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {isOwnedByViewer ? (
              <Button variant="outline" className="flex-1" disabled>
                You Own This Book
              </Button>
            ) : isAvailable ? (
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => onBorrow(book.id)}
              >
                Request to Borrow
              </Button>
            ) : canReturn ? (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onReturn(book.id)}
              >
                Return This Book
              </Button>
            ) : (
              <Button variant="outline" className="flex-1" disabled>
                Currently Borrowed
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
