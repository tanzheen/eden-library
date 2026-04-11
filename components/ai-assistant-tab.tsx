"use client";

import { useChat } from "@ai-sdk/react";
import React, { useState, useRef, useEffect, useMemo, FormEvent } from "react";
import { parseSelectedIds, stripSelectedIds } from "@/lib/books";
import { Sparkles, Loader2, Send, BookOpen, User } from "lucide-react";
import { Button } from "./ui/button";
import { BookDetailsModal } from "./book-details-modal";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import type { Book } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { requestBorrow } from "@/lib/book-orders";

interface AIAssistantTabProps {
  userId: string | null;
  userName: string | null;
}

interface ChatBook {
  id: number;
  title: string;
  author: string;
  description: string | null;
  cover_url: string | null;
  genre_tag?: string | null;
  difficulty?: string | null;
  purpose?: string | null;
  owner_name?: string | null;
  similarity: number;
}

// Render text with **bold** markers converted to <strong> elements
function renderWithBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// Helper to extract text content from message parts
function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

// Helper to find searchBooks tool result from message parts
function getSearchBooksResult(message: UIMessage): ChatBook[] | null {
  for (const part of message.parts) {
    if (
      part.type === "tool-searchBooks" &&
      "state" in part &&
      part.state === "output-available" &&
      "output" in part
    ) {
      return part.output as ChatBook[];
    }
  }
  return null;
}

export function AIAssistantTab({ userId, userName }: AIAssistantTabProps) {
  const [input, setInput] = useState("");
  const [signedCovers, setSignedCovers] = useState<Record<string, string>>({});
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );
  const { messages, sendMessage, status, error } = useChat({
    transport,
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Accumulate every book seen across all tool results so follow-up messages
  // that reference IDs from a previous search still show cards.
  const allBooksMap = useMemo(() => {
    const map = new Map<number, ChatBook>();
    for (const message of messages) {
      const results = getSearchBooksResult(message);
      if (results) {
        for (const book of results) {
          map.set(book.id, book);
        }
      }
    }
    return map;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Batch-sign all cover URLs from search results whenever messages update
  useEffect(() => {
    const urlsToSign: string[] = [];
    for (const message of messages) {
      const results = getSearchBooksResult(message);
      if (results) {
        for (const book of results) {
          if (book.cover_url && !signedCovers[book.cover_url]) {
            urlsToSign.push(book.cover_url);
          }
        }
      }
    }

    if (urlsToSign.length === 0) return;

    fetch("/api/sign-cover-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: [...new Set(urlsToSign)] }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.signedUrls) {
          setSignedCovers((prev) => ({ ...prev, ...data.signedUrls }));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const handleBookClick = async (bookId: number) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("books")
      .select("*")
      .eq("id", bookId)
      .single();
    if (data) setSelectedBook(data as Book);
  };

  const handleBorrow = async (bookId: number) => {
    const result = await requestBorrow(bookId);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    alert("Borrow request sent!");
    setSelectedBook(null);
  };

  const handleReturn = async (_bookId: number) => {};

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const text = input.trim();
    setInput("");
    inputRef.current?.blur();
    await sendMessage({ text });
  };

  if (!userId || !userName) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
        Sign in to use the AI assistant and get personalized recommendations.
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col rounded-2xl border border-border bg-card shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h2 className="text-xl font-bold">AI Librarian</h2>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <Sparkles className="mb-4 h-12 w-12 text-amber-500/50" />
              <h3 className="text-lg font-medium text-foreground">
                Welcome to the Library
              </h3>
              <p className="mt-2 max-w-md text-sm">
                I&apos;m your AI librarian. Tell me what kind of book you&apos;re
                looking for, and I&apos;ll help you find the perfect read from our
                collection.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {[
                  "I want to grow in my prayer life",
                  "Looking for a theology book for beginners",
                  "Something to read with my kids",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setInput(suggestion)}
                    className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            const messageText = getMessageText(m);
            const selectedIds =
              m.role === "assistant" ? parseSelectedIds(messageText) : [];
            const displayText =
              m.role === "assistant"
                ? stripSelectedIds(messageText)
                : messageText;

            const selectedBooks: ChatBook[] = selectedIds
              .map((id) => allBooksMap.get(id))
              .filter((b): b is ChatBook => b !== undefined);

            if (!displayText.trim() && selectedBooks.length === 0) {
              return null;
            }

            return (
              <div key={m.id} className="space-y-3">
                {displayText.trim() && (
                  <div
                    className={`flex gap-3 ${
                      m.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {m.role === "assistant" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300">
                        <Sparkles className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        m.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-base leading-relaxed">
                        {m.role === "assistant" ? renderWithBold(displayText) : displayText}
                      </p>
                    </div>
                    {m.role === "user" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                )}

                {/* Book Cards */}
                {selectedBooks.length > 0 && (
                  <div className="ml-0 sm:ml-11 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedBooks.map((book) => {
                      const coverSrc = book.cover_url
                        ? (signedCovers[book.cover_url] ?? book.cover_url)
                        : null;

                      return (
                        <button
                          key={book.id}
                          type="button"
                          onClick={() => handleBookClick(book.id)}
                          className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
                            {coverSrc ? (
                              <img
                                src={coverSrc}
                                alt={`Cover of ${book.title}`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800">
                                <BookOpen className="h-5 w-5 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate text-sm font-semibold text-foreground">
                              {book.title}
                            </h4>
                            <p className="truncate text-xs text-muted-foreground">
                              by {book.author}
                            </p>
                            {book.owner_name && (
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                Owner: {book.owner_name}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {book.genre_tag && (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                  {book.genre_tag}
                                </span>
                              )}
                              {book.difficulty && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {book.difficulty}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching the shelves...
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              Something went wrong. Please try again.
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me for a book recommendation…"
              className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only sm:not-sr-only">Send</span>
            </Button>
          </form>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            The AI librarian searches our book collection and excludes books
            you&apos;ve already borrowed.
          </p>
        </div>
      </div>

      {selectedBook && (
        <BookDetailsModal
          book={selectedBook}
          userId={userId}
          onClose={() => setSelectedBook(null)}
          onBorrow={handleBorrow}
          onReturn={handleReturn}
        />
      )}
    </>
  );
}
