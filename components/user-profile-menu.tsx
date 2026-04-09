"use client";

import { useEffect, useId, useState } from "react";
import { User } from "@supabase/supabase-js";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LogoutButton } from "./logout-button";

interface UserProfileMenuProps {
  user: Pick<User, "email" | "user_metadata">;
  initialTelehandle: string | null;
}

export function UserProfileMenu({
  user,
  initialTelehandle,
}: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [telehandle, setTelehandle] = useState(initialTelehandle ?? "");
  const [draftTelehandle, setDraftTelehandle] = useState(
    initialTelehandle ?? ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const telehandleId = useId();

  const userName =
    typeof user.user_metadata?.full_name === "string" &&
    user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : user.email ?? "Unknown user";

  const requiresTelehandle = !telehandle.trim();

  useEffect(() => {
    if (requiresTelehandle) {
      setIsOpen(true);
    }
  }, [requiresTelehandle]);

  const handleClose = () => {
    if (requiresTelehandle) {
      return;
    }

    setDraftTelehandle(telehandle);
    setError(null);
    setSuccessMessage(null);
    setIsOpen(false);
  };

  const handleSave = async () => {
    const trimmedTelehandle = draftTelehandle.trim().replace(/^@+/, "");

    if (!trimmedTelehandle) {
      setError("Enter your Telegram handle to continue");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/tele-user", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telehandle: trimmedTelehandle,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        teleUser?: { telehandle: string | null };
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to save telehandle");
      }

      const nextTelehandle = payload.teleUser?.telehandle ?? trimmedTelehandle;

      setTelehandle(nextTelehandle);
      setDraftTelehandle(nextTelehandle);
      setSuccessMessage("Telehandle saved");
      setTimeout(() => {
        setIsOpen(false);
        setSuccessMessage(null);
      }, 700);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save telehandle"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "gap-2",
          requiresTelehandle && "border-amber-500 text-amber-700 dark:text-amber-300"
        )}
        onClick={() => {
          setError(null);
          setSuccessMessage(null);
          setIsOpen(true);
        }}
      >
        <UserRound className="h-4 w-4" />
        <span className="hidden sm:inline">
          {requiresTelehandle ? "Complete profile" : "Profile"}
        </span>
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Your profile</h2>
                <p className="text-sm text-muted-foreground">
                  {requiresTelehandle
                    ? "Add your Telegram handle before using the platform."
                    : "Review your account details and update your Telegram handle."}
                </p>
              </div>
              {!requiresTelehandle ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  onClick={handleClose}
                >
                  Close
                </Button>
              ) : null}
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-xl bg-muted/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Name
                </p>
                <p className="mt-1 text-sm font-medium">{userName}</p>
              </div>

              <div className="rounded-xl bg-muted/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Email
                </p>
                <p className="mt-1 text-sm font-medium">{user.email ?? "No email"}</p>
              </div>

              <div className="rounded-xl bg-muted/60 p-4">
                <label
                  htmlFor={telehandleId}
                  className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Telegram handle
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">@</span>
                  <Input
                    id={telehandleId}
                    value={draftTelehandle}
                    onChange={(event) => setDraftTelehandle(event.target.value)}
                    placeholder="yourhandle"
                    autoComplete="off"
                    disabled={isSaving}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Letters, numbers, and underscores only.
                </p>
              </div>
            </div>

            {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}
            {successMessage ? (
              <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">
                {successMessage}
              </p>
            ) : null}

            <div className="mt-6 flex items-center justify-between gap-3">
              <LogoutButton />
              <div className="flex items-center gap-2">
                {!requiresTelehandle ? (
                  <Button type="button" variant="ghost" onClick={handleClose}>
                    Cancel
                  </Button>
                ) : null}
                <Button type="button" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : telehandle ? "Update handle" : "Save handle"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
