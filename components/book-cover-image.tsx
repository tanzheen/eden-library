"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

interface BookCoverImageProps {
  src: string;
  alt: string;
  className: string;
  sizes?: string;
  fallbackSrc?: string | null;
}

export function BookCoverImage({
  src,
  alt,
  className,
  sizes,
  fallbackSrc,
}: BookCoverImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const [activeFallbackSrc, setActiveFallbackSrc] = useState(fallbackSrc || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const resolveSrc = async () => {
      setResolvedSrc(src);
      setActiveFallbackSrc(fallbackSrc || null);
      setLoading(true);

      if (!src.includes("/storage/v1/object/public/")) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/sign-cover-url?url=${encodeURIComponent(src)}`
        );
        const data = await response.json();

        if (!cancelled && response.ok && data.signedUrl) {
          setResolvedSrc(data.signedUrl);
        }
      } catch {
        // Keep original src if signing fails.
      }
    };

    resolveSrc();

    return () => {
      cancelled = true;
    };
  }, [src, fallbackSrc]);

  return (
    <>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/70">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <Image
        src={resolvedSrc}
        alt={alt}
        fill
        className={className}
        sizes={sizes}
        onLoad={() => setLoading(false)}
        onError={() => {
          if (activeFallbackSrc && activeFallbackSrc !== resolvedSrc) {
            setResolvedSrc(activeFallbackSrc);
            setActiveFallbackSrc(null);
            setLoading(true);
            return;
          }

          setLoading(false);
        }}
      />
    </>
  );
}
