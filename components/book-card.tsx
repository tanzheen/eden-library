"use client";

import { Book } from "@/lib/types";
import { User, BookOpen } from "lucide-react";
import { BookCoverImage } from "./book-cover-image";

interface BookCardProps {
  book: Book;
  userId?: string | null;
  ownerLabel?: string | null;
  statusLabel?: string | null;
  onViewDetails: (book: Book) => void;
}

export function BookCard({
  book,
  userId,
  ownerLabel,
  statusLabel,
  onViewDetails,
}: BookCardProps) {
  const isAvailable = book.status === true;
  const isOwnedByViewer = Boolean(userId && book.owner_id === userId);
  const tags = [book.genre_tag, book.difficulty, book.purpose].filter(
    Boolean
  ) as string[];
  const resolvedOwnerLabel = ownerLabel || book.owner_name || "Unknown Owner";
  const resolvedStatusLabel =
    statusLabel || (isOwnedByViewer ? "Owned" : isAvailable ? "Available" : "Borrowed");

  return (
    <button
      type="button"
      onClick={() => onViewDetails(book)}
      className="group w-full overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-center bg-muted px-4 py-5">
          <div className="relative aspect-[2/3] w-full max-w-[140px] overflow-hidden rounded-md border border-border/60 bg-background shadow-sm">
            {book.cover_url ? (
              <BookCoverImage
                src={book.cover_url}
                alt={`Cover of ${book.title}`}
                className="object-contain"
                sizes="140px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800">
                <BookOpen className="h-10 w-10 text-muted-foreground/40" />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="space-y-1">
            <h3 className="text-lg font-bold leading-tight text-foreground transition-colors group-hover:text-blue-700 dark:group-hover:text-blue-400">
              {book.title}
            </h3>
            <p className="text-sm text-muted-foreground">by {book.author}</p>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{resolvedOwnerLabel}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
              >
                {tag}
              </span>
            ))}
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                resolvedStatusLabel === "Owned"
                  ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  : resolvedStatusLabel === "Available"
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
              }`}
            >
              {resolvedStatusLabel}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
