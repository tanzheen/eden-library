import { HeaderBanner } from "@/components/header-banner";
import { MainContent } from "@/components/main-content";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

async function AuthenticatedContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const userId = user?.id || null;
  const userName = user?.user_metadata?.full_name || user?.email || null;

  return <MainContent userId={userId} userName={userName} />;
}

export default function Home() {
  return (
    <main className="h-dvh flex flex-col overflow-hidden bg-background">
      <Suspense fallback={<HeaderSkeleton />}>
        <HeaderBanner />
      </Suspense>
      <Suspense fallback={<ContentSkeleton />}>
        <AuthenticatedContent />
      </Suspense>
    </main>
  );
}

function HeaderSkeleton() {
  return (
    <header className="relative w-full">
      <div className="h-48 md:h-64 w-full bg-muted animate-pulse" />
      <nav className="w-full bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 h-12" />
      </nav>
    </header>
  );
}

function ContentSkeleton() {
  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
      <div className="h-12 w-32 bg-muted rounded animate-pulse mb-8" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-80 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}
