"use client";

import { Home, BookOpen } from "lucide-react";

interface TabNavigationProps {
  activeTab: "home" | "catalogue";
  onTabChange: (tab: "home" | "catalogue") => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="w-full border-b border-border bg-background sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex gap-1">
          <button
            onClick={() => onTabChange("home")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "home"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Home className="h-4 w-4" />
            Home
          </button>
          <button
            onClick={() => onTabChange("catalogue")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "catalogue"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Catalogue
          </button>
        </div>
      </div>
    </div>
  );
}
