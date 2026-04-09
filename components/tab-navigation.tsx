"use client";

import { Home, BookOpen, FolderCog, Bot } from "lucide-react";

interface TabNavigationProps {
  activeTab: "home" | "catalogue" | "manage" | "assistant";
  onTabChange: (tab: "home" | "catalogue" | "manage" | "assistant") => void;
  showManageTab?: boolean;
  showAssistantTab?: boolean;
}

export function TabNavigation({
  activeTab,
  onTabChange,
  showManageTab = false,
  showAssistantTab = false,
}: TabNavigationProps) {
  return (
    <div className="w-full border-b border-border bg-background sticky top-0 z-40">
      <div className="max-w-6xl mx-auto overflow-x-auto px-4">
        <div className="flex min-w-max gap-1">
          <button
            onClick={() => onTabChange("home")}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "catalogue"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Catalogue
          </button>
          {showAssistantTab && (
            <button
              onClick={() => onTabChange("assistant")}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "assistant"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Bot className="h-4 w-4" />
              AI Assistant
            </button>
          )}
          {showManageTab && (
            <button
              onClick={() => onTabChange("manage")}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "manage"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <FolderCog className="h-4 w-4" />
              Manage Books
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
