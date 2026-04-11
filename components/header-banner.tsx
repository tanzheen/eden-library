import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ThemeSwitcher } from "./theme-switcher";
import { Button } from "./ui/button";
import { UserProfileMenu } from "./user-profile-menu";
import { createAdminClient } from "@/lib/supabase/admin";
import { CollapsibleBanner } from "./collapsible-banner";

export async function HeaderBanner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let initialTelehandle: string | null = null;

  if (user) {
    try {
      const adminClient = createAdminClient();
      const { data } = await adminClient
        .from("tele_users")
        .select("telehandle")
        .eq("owner_id", user.id)
        .maybeSingle();

      initialTelehandle = data?.telehandle ?? null;
    } catch (error) {
      console.error("Failed to load telehandle:", error);
    }
  }

  return (
    <header className="relative w-full">
      <CollapsibleBanner />
      <nav className="w-full bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg hover:text-primary/80 transition-colors">
            Eden Library
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user.user_metadata?.full_name || user.email}
                </span>
                <UserProfileMenu
                  user={{
                    email: user.email ?? undefined,
                    user_metadata: user.user_metadata,
                  }}
                  initialTelehandle={initialTelehandle}
                />
              </div>
            ) : (
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/auth/login">Sign in with Google</Link>
              </Button>
            )}
            <ThemeSwitcher />
          </div>
        </div>
      </nav>
    </header>
  );
}
