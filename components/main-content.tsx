"use client";

import { useState } from "react";
import { TabNavigation } from "./tab-navigation";
import { CatalogueTab } from "./catalogue-tab";
import { ManageBooksTab } from "./manage-books-tab";
import { AIAssistantTab } from "./ai-assistant-tab";

interface MainContentProps {
  userId: string | null;
  userName: string | null;
}

export function MainContent({ userId, userName }: MainContentProps) {
  const [activeTab, setActiveTab] = useState<"catalogue" | "manage" | "assistant">(
    "catalogue"
  );

  return (
    <>
      <TabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showManageTab={Boolean(userId)}
        showAssistantTab={Boolean(userId)}
      />
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
        {activeTab === "assistant" ? (
          <AIAssistantTab userId={userId} userName={userName} />
        ) : activeTab === "catalogue" ? (
          <CatalogueTab userId={userId} userName={userName} />
        ) : (
          <ManageBooksTab userId={userId} userName={userName} />
        )}
      </div>
    </>
  );
}
