"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function CollapsibleBanner() {
  const [scrollCollapsed, setScrollCollapsed] = useState(false);
  const [tabCollapsed, setTabCollapsed] = useState(false);
  const collapsed = scrollCollapsed || tabCollapsed;

  useEffect(() => {
    const el = document.getElementById("main-scroll");
    if (!el) return;

    const handleScroll = () => {
      setScrollCollapsed(el.scrollTop > 10);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const { tab } = (e as CustomEvent<{ tab: string }>).detail;
      setTabCollapsed(tab !== "catalogue");
    };

    window.addEventListener("banner-tab-change", handleTabChange);
    return () => window.removeEventListener("banner-tab-change", handleTabChange);
  }, []);

  return (
    <div
      style={{
        maxHeight: collapsed ? 0 : "16rem",
        transition: "max-height 0.35s ease-in-out",
        overflow: "hidden",
      }}
    >
      <div className="relative h-24 sm:h-48 md:h-64 w-full overflow-hidden">
        <Image
          src="/header-wallpaper.webp"
          alt="Eden Library Banner"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/60" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight drop-shadow-lg">
            Eden Library
          </h1>
          <p className="mt-1 text-sm sm:text-lg md:text-xl text-white/90 drop-shadow">
            Knowing Jesus through books
          </p>
        </div>
      </div>
    </div>
  );
}
