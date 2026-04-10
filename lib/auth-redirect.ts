"use client";

export function buildLoginPath(nextPath?: string) {
  const safeNextPath =
    nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/";

  const params = new URLSearchParams();
  params.set("next", safeNextPath);

  return `/auth/login?${params.toString()}`;
}

export function getCurrentPath() {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.search}`;
}
