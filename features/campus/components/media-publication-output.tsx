"use client";

import { cn } from "cn";
import type { ReactNode, Ref } from "react";

import { useMediaElementRef } from "../hooks/use-media-element-ref";
import type { MediaPublication } from "../services/media-session/contracts";

type MediaPublicationOutputProps = Readonly<{
  className?: string;
  fallbackClassName?: string;
  fallbackInitials?: string;
  fallbackLabel: string;
  fit?: "cover" | "contain";
  label: string;
  ref?: Ref<HTMLDivElement>;
  videoPublication?: MediaPublication;
  // A slot, so the Join Gate's preview does not load Motion for a tile's need.
  wrapFallback?: (fallback: ReactNode) => ReactNode;
}>;

const asIs = (fallback: ReactNode) => fallback;

export function MediaPublicationOutput({
  className,
  fallbackClassName,
  fallbackInitials,
  fallbackLabel,
  fit = "cover",
  label,
  ref,
  videoPublication,
  wrapFallback = asIs,
}: MediaPublicationOutputProps) {
  const videoRef = useMediaElementRef(videoPublication);
  const showVideo = Boolean(
    videoPublication?.enabled && videoPublication.track.readyState === "live",
  );

  return (
    <div
      ref={ref}
      data-video-state={showVideo ? "visible" : "fallback"}
      className={cn(
        "bg-surface relative grid size-full place-items-center overflow-hidden",
        className,
      )}
    >
      {videoPublication ? (
        <video
          ref={videoRef}
          aria-label={label}
          autoPlay
          muted
          playsInline
          className={cn(
            "size-full",
            fit === "contain" ? "object-contain" : "object-cover",
            showVideo ? "opacity-100" : "absolute opacity-0",
          )}
        />
      ) : null}

      {showVideo
        ? null
        : wrapFallback(
            <div className="text-foreground-secondary grid place-items-center gap-2 text-center">
              {fallbackInitials ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "bg-muted text-foreground grid size-12 place-items-center rounded-full font-medium",
                    fallbackClassName,
                  )}
                >
                  {fallbackInitials}
                </span>
              ) : null}
              <span className="text-xs">{fallbackLabel}</span>
            </div>,
          )}
    </div>
  );
}
