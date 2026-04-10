"use client";

import { useChat } from "@ai-sdk/react";
import React, { useState, useRef, useEffect, useMemo, FormEvent } from "react";
import { parseSelectedIds, stripSelectedIds } from "@/lib/books";
import { Sparkles, Loader2, Send, BookOpen, User } from "lucide-react";
import { BookCoverImage } from "./book-cover-image";
import { Button } from "./ui/button";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const text = input.trim();
    setInput("");
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

          // Find the searchBooks tool result on this message
          const searchResults = m.role === "assistant" ? getSearchBooksResult(m) : null;
          const selectedBooks: ChatBook[] = searchResults
            ? searchResults.filter((b) => selectedIds.includes(b.id))
            : [];

          // Don't render empty messages
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
                <div className="ml-11 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedBooks.map((book) => (
                    <div
                      key={book.id}
                      className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md"
                    >
                      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
                        {book.cover_url ? (
                          <BookCoverImage
                            src={book.cover_url}
                            alt={`Cover of ${book.title}`}
                            className="object-cover"
                            sizes="56px"
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
                    </div>
                  ))}
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What kind of book are you looking for?"
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
  );
}
