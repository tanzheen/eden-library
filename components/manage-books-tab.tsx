"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { approveOrder, returnOrder } from "@/lib/book-orders";
import { Book } from "@/lib/types";
import { resolveBookCoverUrls } from "@/lib/resolve-book-covers";
import { BookDetailsModal } from "./book-details-modal";
import { BookCoverImage } from "./book-cover-image";
import { Button } from "./ui/button";
import { Loader2, Trash2, BookOpen, Inbox, Clock3 } from "lucide-react";

interface ManageBooksTabProps {
  userId: string | null;
  userName: string | null;
}

interface OrderRecord {
  id: number;
  book_id: number;
  owner_id: string;
  borrower_id: string;
  status: "requested" | "borrowed" | "returned" | "cancelled";
  book?: Book;
}

interface RawOrderRecord {
  id: number;
  book_id: number;
  owner_id: string;
  borrower_id: string;
  status: "requested" | "borrowed" | "returned" | "cancelled";
  book?: Book | Book[] | null;
}

function normalizeOrderRecord(order: RawOrderRecord): OrderRecord {
  const normalizedBook = Array.isArray(order.book) ? order.book[0] : order.book;

  return {
    id: order.id,
    book_id: order.book_id,
    owner_id: order.owner_id,
    borrower_id: order.borrower_id,
    status: order.status,
    book: normalizedBook || undefined,
  };
}

export function ManageBooksTab({ userId, userName }: ManageBooksTabProps) {
  const [ownedBooks, setOwnedBooks] = useState<Book[]>([]);
  const [requestedOrders, setRequestedOrders] = useState<OrderRecord[]>([]);
  const [borrowedOutOrders, setBorrowedOutOrders] = useState<OrderRecord[]>([]);
  const [borrowedByMeOrders, setBorrowedByMeOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingBookId, setDeletingBookId] = useState<number | null>(null);
  const [actingOrderId, setActingOrderId] = useState<number | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const supabase = createClient();

  const fetchBooks = useCallback(async () => {
    if (!userId) {
      setOwnedBooks([]);
      setRequestedOrders([]);
      setBorrowedOutOrders([]);
      setBorrowedByMeOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [{ data: owned, error: ownedError }, { data: ownerOrders, error: ownerOrdersError }, { data: borrowedByMe, error: borrowedByMeError }] =
      await Promise.all([
        supabase.from("books").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select("id, book_id, owner_id, borrower_id, status, book:books(*)")
          .eq("owner_id", userId)
          .in("status", ["requested", "borrowed"])
          .order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select("id, book_id, owner_id, borrower_id, status, book:books(*)")
          .eq("borrower_id", userId)
          .eq("status", "borrowed")
          .order("borrowed_at", { ascending: false }),
      ]);

    if (ownedError) {
      console.error("Failed to fetch owned books:", ownedError);
      setOwnedBooks([]);
    } else {
      setOwnedBooks(await resolveBookCoverUrls((owned || []) as Book[]));
    }

    if (ownerOrdersError) {
      console.error("Failed to fetch owner orders:", ownerOrdersError);
      setRequestedOrders([]);
      setBorrowedOutOrders([]);
    } else {
      const resolvedOwnerOrders = await Promise.all(
        ((ownerOrders || []) as RawOrderRecord[]).map(async (rawOrder) => {
          const order = normalizeOrderRecord(rawOrder);

          return {
          ...order,
          book: order.book
            ? (await resolveBookCoverUrls([order.book]))[0]
            : undefined,
          };
        })
      );

      setRequestedOrders(
        resolvedOwnerOrders.filter((order) => order.status === "requested")
      );
      setBorrowedOutOrders(
        resolvedOwnerOrders.filter((order) => order.status === "borrowed")
      );
    }

    if (borrowedByMeError) {
      console.error("Failed to fetch borrowed orders:", borrowedByMeError);
      setBorrowedByMeOrders([]);
    } else {
      const resolvedBorrowedOrders = await Promise.all(
        ((borrowedByMe || []) as RawOrderRecord[]).map(async (rawOrder) => {
          const order = normalizeOrderRecord(rawOrder);

          return {
          ...order,
          book: order.book
            ? (await resolveBookCoverUrls([order.book]))[0]
            : undefined,
          };
        })
      );

      setBorrowedByMeOrders(resolvedBorrowedOrders);
    }

    setLoading(false);
  }, [supabase, userId]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock3 className="h-5 w-5 text-amber-500" />
          <div>
            <h2 className="text-xl font-bold">Pending Requests</h2>
            <p className="text-sm text-muted-foreground">
              Approve requests before the borrowing actually happens.
            </p>
          </div>
        </div>

        {requestedOrders.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
            No pending requests right now.
          </div>
        ) : (
          <div className="grid gap-4">
            {requestedOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">
                      {order.book?.title || "Unknown book"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Borrower ID: {order.borrower_id}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleApproveOrder(order.id)}
                    disabled={actingOrderId === order.id}
                  >
                    {actingOrderId === order.id ? "Approving..." : "Approve"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold">Your Books</h2>
            <p className="text-sm text-muted-foreground">
              See what is available, borrowed out, or ready to remove.
            </p>
          </div>
        </div>

        {ownedBooks.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
            You have not added any books yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {ownedBooks.map((book) => {
              const activeBorrow = borrowedOutOrders.find(
                (order) => order.book_id === book.id
              );
              const canDelete = book.status === true && !activeBorrow;

              return (
                <div
                  key={book.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
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
                          ? `Currently borrowed by user ${activeBorrow.borrower_id}`
                          : "No one is currently borrowing this book."}
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
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-amber-500" />
          <div>
            <h2 className="text-xl font-bold">Books You Borrowed</h2>
            <p className="text-sm text-muted-foreground">
              Books that have already been approved and handed over to you.
            </p>
          </div>
        </div>

        {borrowedByMeOrders.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
            You are not currently borrowing any approved books.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {borrowedByMeOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
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
            ))}
          </div>
        )}
      </section>

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
