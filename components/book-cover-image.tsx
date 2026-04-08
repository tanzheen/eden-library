"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

interface BookCoverImageProps {
  src: string;
  alt: string;
  className: string;
  sizes?: string;
}

export function BookCoverImage({
  src,
  alt,
  className,
  sizes,
}: BookCoverImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const resolveSrc = async () => {
      setResolvedSrc(src);
      setLoading(true);

      if (!src.includes("/storage/v1/object/public/")) {
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
  }, [src]);

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
        onError={() => setLoading(false)}
      />
    </>
  );
}
