import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ThemeSwitcher } from "./theme-switcher";
import { Button } from "./ui/button";
import { UserProfileMenu } from "./user-profile-menu";
import { createAdminClient } from "@/lib/supabase/admin";

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
      <div className="relative h-48 md:h-64 w-full overflow-hidden">
        <Image
          src="/header-wallpaper.webp"
          alt="Eden Library Banner"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/60" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight drop-shadow-lg">
            Eden Library
          </h1>
          <p className="mt-2 text-lg md:text-xl text-white/90 drop-shadow">
            Knowing Jesus through books
          </p>
        </div>
      </div>
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
