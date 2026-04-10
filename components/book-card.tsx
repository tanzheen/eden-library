"use client";

import { Book } from "@/lib/types";
import { User, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { buildLoginPath, getCurrentPath } from "@/lib/auth-redirect";
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
  const router = useRouter();
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
      onClick={() => {
        if (!userId) {
          router.push(buildLoginPath(getCurrentPath()));
          return;
        }
        onViewDetails(book);
      }}
      className="group w-full overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:rounded-xl"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-center bg-muted px-2 py-3 sm:px-4 sm:py-5">
          <div className="relative aspect-[2/3] w-full max-w-[92px] overflow-hidden rounded-md border border-border/60 bg-background shadow-sm sm:max-w-[140px]">
            {book.cover_url ? (
              <BookCoverImage
                src={book.cover_url}
                alt={`Cover of ${book.title}`}
                className="object-contain"
                sizes="(max-width: 640px) 92px, 140px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800">
                <BookOpen className="h-7 w-7 text-muted-foreground/40 sm:h-10 sm:w-10" />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-5">
          <div className="space-y-1">
            <h3 className="text-sm font-bold leading-tight text-foreground transition-colors group-hover:text-blue-700 dark:group-hover:text-blue-400 sm:text-lg">
              {book.title}
            </h3>
            <p className="text-xs text-muted-foreground sm:text-sm">by {book.author}</p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2 sm:text-sm">
            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{resolvedOwnerLabel}</span>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 sm:px-3 sm:py-1 sm:text-xs"
              >
                {tag}
              </span>
            ))}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium sm:px-3 sm:py-1 sm:text-xs ${
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
