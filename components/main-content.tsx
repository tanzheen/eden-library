"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildLoginPath, getCurrentPath } from "@/lib/auth-redirect";
import { TabNavigation } from "./tab-navigation";
import { CatalogueTab } from "./catalogue-tab";
import { ManageBooksTab } from "./manage-books-tab";
import { AIAssistantTab } from "./ai-assistant-tab";

interface MainContentProps {
  userId: string | null;
  userName: string | null;
}

export function MainContent({ userId, userName }: MainContentProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"catalogue" | "manage" | "assistant">(
    "catalogue"
  );

  const handleTabChange = (tab: "catalogue" | "manage" | "assistant") => {
    if (!userId && tab !== "catalogue") {
      router.push(buildLoginPath(getCurrentPath()));
      return;
    }

    setActiveTab(tab);
  };

  return (
    <>
      <TabNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        showManageTab
        showAssistantTab
      />
      {activeTab === "assistant" ? (
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden w-full max-w-6xl mx-auto px-2 py-2 sm:px-4 sm:py-4">
          <AIAssistantTab userId={userId} userName={userName} />
        </div>
      ) : (
        <div id="main-scroll" className="flex-1 overflow-y-auto w-full max-w-6xl mx-auto px-4 py-8">
          {activeTab === "catalogue" ? (
            <CatalogueTab userId={userId} userName={userName} />
          ) : (
            <ManageBooksTab userId={userId} userName={userName} />
          )}
        </div>
      )}
    </>
  );
}
