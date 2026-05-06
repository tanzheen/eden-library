"use client";

import { useCallback, useEffect, useState } from "react";
import { approveOrder, returnOrder } from "@/lib/book-orders";
import { Book } from "@/lib/types";
import { resolveBookCoverUrls } from "@/lib/resolve-book-covers";
import { BookDetailsModal } from "./book-details-modal";
import { BookCoverImage } from "./book-cover-image";
import { Button } from "./ui/button";
import { Loader2, Trash2, BookOpen, Inbox, Clock3, ChevronDown } from "lucide-react";

interface ManageBooksTabProps {
  userId: string | null;
  userName: string | null;
}

interface OrderRecord {
  id: number;
  book_id: number;
  owner_id: string;
  borrower_id: string;
  owner_name: string | null;
  borrower_name: string | null;
  note: string | null;
  status: "requested" | "borrowed" | "returned" | "cancelled";
  book?: Book;
}

interface RawOrderRecord {
  id: number;
  book_id: number;
  owner_id: string;
  borrower_id: string;
  owner_name: string | null;
  borrower_name: string | null;
  note?: string | null;
  status: "requested" | "borrowed" | "returned" | "cancelled";
  book?: Book | Book[] | null;
}

type SectionKey =
  | "pendingRequests"
  | "loanedOut"
  | "requestedByMe"
  | "borrowedByMe"
  | "ownedBooks";

type SectionState = Record<SectionKey, boolean>;

function normalizeOrderRecord(order: RawOrderRecord): OrderRecord {
  const normalizedBook = Array.isArray(order.book) ? order.book[0] : order.book;

  return {
    id: order.id,
    book_id: order.book_id,
    owner_id: order.owner_id,
    borrower_id: order.borrower_id,
    owner_name: order.owner_name,
    borrower_name: order.borrower_name,
    note: order.note ?? null,
    status: order.status,
    book: normalizedBook || undefined,
  };
}

export function ManageBooksTab({ userId, userName }: ManageBooksTabProps) {
  const [ownedBooks, setOwnedBooks] = useState<Book[]>([]);
  const [requestedOrders, setRequestedOrders] = useState<OrderRecord[]>([]);
  const [borrowedOutOrders, setBorrowedOutOrders] = useState<OrderRecord[]>([]);
  const [requestedByMeOrders, setRequestedByMeOrders] = useState<OrderRecord[]>([]);
  const [borrowedByMeOrders, setBorrowedByMeOrders] = useState<OrderRecord[]>([]);
  const [deletingBookId, setDeletingBookId] = useState<number | null>(null);
  const [actingOrderId, setActingOrderId] = useState<number | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [expanded, setExpanded] = useState<SectionState>({
    pendingRequests: false,
    loanedOut: false,
    requestedByMe: false,
    borrowedByMe: false,
    ownedBooks: false,
  });
  const [loadingSections, setLoadingSections] = useState<SectionState>({
    pendingRequests: true,
    loanedOut: true,
    requestedByMe: true,
    borrowedByMe: true,
    ownedBooks: true,
  });

  const toggleSection = (key: SectionKey) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const fetchBooks = useCallback(async () => {
    if (!userId) {
      setOwnedBooks([]);
      setRequestedOrders([]);
      setBorrowedOutOrders([]);
      setRequestedByMeOrders([]);
      setBorrowedByMeOrders([]);
      setLoadingSections({
        pendingRequests: false,
        loanedOut: false,
        requestedByMe: false,
        borrowedByMe: false,
        ownedBooks: false,
      });
      return;
    }

    setLoadingSections({
      pendingRequests: true,
      loanedOut: true,
      requestedByMe: true,
      borrowedByMe: true,
      ownedBooks: true,
    });

    try {
      const response = await fetch("/api/manage-books", {
        method: "GET",
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch manage books data");
      }

      const owned = (result.ownedBooks || []) as Book[];
      const ownerOrders = (result.ownerOrders || []) as RawOrderRecord[];
      const borrowerOrders = (result.borrowerOrders || []) as RawOrderRecord[];

      setOwnedBooks(await resolveBookCoverUrls(owned));

      const resolvedOwnerOrders = await Promise.all(
        ownerOrders.map(async (rawOrder) => {
          const order = normalizeOrderRecord(rawOrder);

          return {
            ...order,
            book: order.book ? (await resolveBookCoverUrls([order.book]))[0] : undefined,
          };
        })
      );

      const resolvedBorrowerOrders = await Promise.all(
        borrowerOrders.map(async (rawOrder) => {
          const order = normalizeOrderRecord(rawOrder);

          return {
            ...order,
            book: order.book ? (await resolveBookCoverUrls([order.book]))[0] : undefined,
          };
        })
      );

      setRequestedOrders(resolvedOwnerOrders.filter((order) => order.status === "requested"));
      setBorrowedOutOrders(resolvedOwnerOrders.filter((order) => order.status === "borrowed"));
      setRequestedByMeOrders(
        resolvedBorrowerOrders.filter((order) => order.status === "requested")
      );
      setBorrowedByMeOrders(
        resolvedBorrowerOrders.filter((order) => order.status === "borrowed")
      );
    } catch (error) {
      console.error("Failed to fetch manage books data:", error);
      setOwnedBooks([]);
      setRequestedOrders([]);
      setBorrowedOutOrders([]);
      setRequestedByMeOrders([]);
      setBorrowedByMeOrders([]);
    } finally {
      setLoadingSections({
        pendingRequests: false,
        loanedOut: false,
        requestedByMe: false,
        borrowedByMe: false,
        ownedBooks: false,
      });
    }
  }, [userId]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleDeleteBook = async (bookId: number) => {
    const confirmed = window.confirm(
      "Delete this book from your library? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setDeletingBookId(bookId);

    try {
      const response = await fetch("/api/delete-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Failed to delete book");
        return;
      }

      setOwnedBooks((prev) => prev.filter((book) => book.id !== bookId));
    } catch (error) {
      console.error("Failed to delete book:", error);
      alert("Failed to delete book");
    } finally {
      setDeletingBookId(null);
    }
  };

  const handleApproveOrder = async (orderId: number) => {
    setActingOrderId(orderId);
    const result = await approveOrder(orderId);
    setActingOrderId(null);

    if (!result.ok) {
      alert(result.error);
      return;
    }

    fetchBooks();
  };

  const handleReturnOrder = async (orderId: number) => {
    setActingOrderId(orderId);
    const result = await returnOrder(orderId);
    setActingOrderId(null);

    if (!result.ok) {
      alert(result.error);
      return;
    }

    fetchBooks();
    setSelectedBook(null);
  };

  if (!userId || !userName) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
        Sign in to manage your books and borrowing activity.
      </div>
    );
  }

  const sectionCounts: Record<SectionKey, number> = {
    pendingRequests: requestedOrders.length,
    loanedOut: borrowedOutOrders.length,
    requestedByMe: requestedByMeOrders.length,
    borrowedByMe: borrowedByMeOrders.length,
    ownedBooks: ownedBooks.length,
  };

  const renderSectionContent = (
    sectionKey: SectionKey,
    emptyState: string,
    content: React.ReactNode,
    gridClassName = "grid gap-4"
  ) => {
    if (loadingSections[sectionKey]) {
      return (
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm">Loading section...</p>
        </div>
      );
    }

    if (sectionCounts[sectionKey] === 0) {
      return (
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
          {emptyState}
        </div>
      );
    }

    return <div className={gridClassName}>{content}</div>;
  };

  const renderSection = ({
    sectionKey,
    icon,
    title,
    description,
    content,
    emptyState,
    gridClassName,
  }: {
    sectionKey: SectionKey;
    icon: React.ReactNode;
    title: string;
    description: string;
    content: React.ReactNode;
    emptyState: string;
    gridClassName?: string;
  }) => (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => toggleSection(sectionKey)}
        className="flex w-full items-center justify-between gap-3 p-4"
      >
        <div className="flex items-center gap-3">
          {icon}
          <div className="text-left">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">{title}</h2>
              <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {loadingSections[sectionKey] ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  sectionCounts[sectionKey]
                )}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ${
            expanded[sectionKey] ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>

      <div
        className={`grid overflow-hidden border-t border-border transition-[grid-template-rows,opacity] duration-300 ease-out ${
          expanded[sectionKey] ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-4 p-4">
            {renderSectionContent(sectionKey, emptyState, content, gridClassName)}
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div className="space-y-4">
      {renderSection({
        sectionKey: "pendingRequests",
        icon: <Clock3 className="h-5 w-5 text-amber-500" />,
        title: "Pending Requests",
        description: "Approve requests before the borrowing actually happens.",
        emptyState: "No pending requests right now.",
        content: requestedOrders.map((order) => (
          <div
            key={order.id}
            className="rounded-xl border border-border bg-muted/30 p-4"
          >
            <div className="flex items-center gap-4">
              <div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                {order.book?.cover_url ? (
                  <BookCoverImage
                    src={order.book.cover_url}
                    alt={`Cover of ${order.book.title}`}
                    className="object-contain"
                    sizes="64px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <BookOpen className="h-6 w-6 opacity-40" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">
                  {order.book?.title || "Unknown book"}
                </p>
                <p className="text-sm text-muted-foreground">
                  by {order.book?.author || "Unknown author"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Requested by{" "}
                  <span className="font-medium text-foreground">
                    {order.borrower_name || "Unknown"}
                  </span>
                </p>
                {order.note && (
                  <p className="mt-2 text-sm text-muted-foreground italic">
                    &quot;{order.note}&quot;
                  </p>
                )}
              </div>
              <Button
                onClick={() => handleApproveOrder(order.id)}
                disabled={actingOrderId === order.id}
                className="shrink-0"
              >
                {actingOrderId === order.id ? "Approving..." : "Approve"}
              </Button>
            </div>
          </div>
        )),
      })}

      {renderSection({
        sectionKey: "loanedOut",
        icon: <BookOpen className="h-5 w-5 text-green-600" />,
        title: "Loaned Out",
        description: "Your books currently with a borrower.",
        emptyState: "None of your books are currently loaned out.",
        gridClassName: "grid gap-4 md:grid-cols-2",
        content: borrowedOutOrders.map((order) => (
          <div
            key={order.id}
            className="rounded-xl border border-border bg-muted/30 p-4"
          >
            <div className="flex gap-4">
              <div className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                {order.book?.cover_url ? (
                  <BookCoverImage
                    src={order.book.cover_url}
                    alt={`Cover of ${order.book.title}`}
                    className="object-contain"
                    sizes="80px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <BookOpen className="h-7 w-7 opacity-40" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => order.book && setSelectedBook(order.book)}
                    className="text-left font-semibold text-foreground hover:text-blue-600"
                  >
                    {order.book?.title || "Unknown book"}
                  </button>
                  <p className="text-sm text-muted-foreground">
                    by {order.book?.author || "Unknown author"}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Borrowed by{" "}
                  <span className="font-medium text-foreground">
                    {order.borrower_name || "Unknown"}
                  </span>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReturnOrder(order.id)}
                  disabled={actingOrderId === order.id}
                >
                  {actingOrderId === order.id ? "Returning..." : "Mark as Returned"}
                </Button>
              </div>
            </div>
          </div>
        )),
      })}

      {renderSection({
        sectionKey: "requestedByMe",
        icon: <Inbox className="h-5 w-5 text-amber-500" />,
        title: "Requested By You",
        description: "Books you requested that are still waiting for the owner's approval.",
        emptyState: "You do not have any outgoing requests awaiting approval.",
        gridClassName: "grid gap-4 md:grid-cols-2",
        content: requestedByMeOrders.map((order) => (
          <div
            key={order.id}
            className="rounded-xl border border-border bg-muted/30 p-4"
          >
            <div className="flex gap-4">
              <div className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                {order.book?.cover_url ? (
                  <BookCoverImage
                    src={order.book.cover_url}
                    alt={`Cover of ${order.book.title}`}
                    className="object-contain"
                    sizes="80px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <BookOpen className="h-7 w-7 opacity-40" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => order.book && setSelectedBook(order.book)}
                    className="text-left font-semibold text-foreground hover:text-blue-600"
                  >
                    {order.book?.title || "Unknown book"}
                  </button>
                  <p className="text-sm text-muted-foreground">
                    by {order.book?.author || "Unknown author"}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Owned by{" "}
                  <span className="font-medium text-foreground">
                    {order.book?.owner_name || "Unknown owner"}
                  </span>
                </p>
                <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                  Awaiting approval
                </div>
              </div>
            </div>
          </div>
        )),
      })}

      {renderSection({
        sectionKey: "borrowedByMe",
        icon: <BookOpen className="h-5 w-5 text-blue-600" />,
        title: "Borrowed Books",
        description: "Books that have already been approved and handed over to you.",
        emptyState: "You are not currently borrowing any approved books.",
        gridClassName: "grid gap-4 md:grid-cols-2",
        content: borrowedByMeOrders.map((order) => (
          <div
            key={order.id}
            className="rounded-xl border border-border bg-muted/30 p-4"
          >
            <div className="flex gap-4">
              <div className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                {order.book?.cover_url ? (
                  <BookCoverImage
                    src={order.book.cover_url}
                    alt={`Cover of ${order.book.title}`}
                    className="object-contain"
                    sizes="80px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <BookOpen className="h-7 w-7 opacity-40" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => order.book && setSelectedBook(order.book)}
                    className="text-left font-semibold text-foreground hover:text-blue-600"
                  >
                    {order.book?.title || "Unknown book"}
                  </button>
                  <p className="text-sm text-muted-foreground">
                    by {order.book?.author || "Unknown author"}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Owned by{" "}
                  <span className="font-medium text-foreground">
                    {order.book?.owner_name || "Unknown owner"}
                  </span>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReturnOrder(order.id)}
                  disabled={actingOrderId === order.id}
                >
                  {actingOrderId === order.id ? "Returning..." : "Mark as Returned"}
                </Button>
              </div>
            </div>
          </div>
        )),
      })}

      {renderSection({
        sectionKey: "ownedBooks",
        icon: <BookOpen className="h-5 w-5 text-blue-600" />,
        title: "Your Books",
        description: "See what is available, borrowed out, or ready to remove.",
        emptyState: "You have not added any books yet.",
        content: ownedBooks.map((book) => {
          const activeBorrow = borrowedOutOrders.find(
            (order) => order.book_id === book.id
          );
          const canDelete = book.status === true && !activeBorrow;

          return (
            <div
              key={book.id}
              className="rounded-xl border border-border bg-muted/30 p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative mx-auto aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:mx-0">
                  {book.cover_url ? (
                    <BookCoverImage
                      src={book.cover_url}
                      alt={`Cover of ${book.title}`}
                      className="object-contain"
                      sizes="96px"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      <BookOpen className="h-8 w-8 opacity-40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBook(book)}
                    className="text-left text-lg font-semibold text-foreground hover:text-blue-600"
                  >
                    {book.title}
                  </button>
                  <p className="text-sm text-muted-foreground">by {book.author}</p>
                  <p className="text-sm text-muted-foreground">
                    {activeBorrow
                      ? `Currently borrowed by ${activeBorrow.borrower_name || "Unknown"}`
                      : "Available"}
                  </p>
                </div>
                <div className="flex shrink-0 items-start">
                  <Button
                    variant="outline"
                    disabled={!canDelete || deletingBookId === book.id}
                    onClick={() => handleDeleteBook(book.id)}
                    className="gap-2"
                  >
                    {deletingBookId === book.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          );
        }),
      })}

      {selectedBook && (
        <BookDetailsModal
          book={selectedBook}
          userId={userId}
          canReturn={borrowedByMeOrders.some((order) => order.book_id === selectedBook.id)}
          onClose={() => setSelectedBook(null)}
          onBorrow={() => {}}
          onReturn={(bookId) => {
            const matchingOrder = borrowedByMeOrders.find(
              (order) => order.book_id === bookId
            );
            if (matchingOrder) {
              handleReturnOrder(matchingOrder.id);
            }
          }}
        />
      )}
    </div>
  );
}
