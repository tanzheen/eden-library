"use client";

import { useState } from "react";
import { BookList } from "./book-list";
import { AddBookForm } from "./add-book-form";
import { Library } from "lucide-react";

export function BookExchange() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleBookAdded = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Library className="h-6 w-6" />
            Book Exchange
          </h2>
          <p className="text-muted-foreground mt-1">
            Browse available books to borrow or share your own
          </p>
        </div>
        <AddBookForm
          onBookAdded={handleBookAdded}
          userId={null}
          userName={null}
        />
      </div>

      <BookList refreshTrigger={refreshTrigger} userId={null} />
    </div>
  );
}
