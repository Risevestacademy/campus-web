"use client";

import { cn } from "cn";

import { useMediaElementRef } from "../hooks/use-media-element-ref";
import type { MediaPublication } from "../services/media-session/contracts";

type MediaPublicationOutputProps = Readonly<{
  className?: string;
  fallbackInitials?: string;
  fallbackLabel: string;
  label: string;
  videoPublication?: MediaPublication;
}>;

export function MediaPublicationOutput({
  className,
  fallbackInitials,
  fallbackLabel,
  label,
  videoPublication,
}: MediaPublicationOutputProps) {
  const videoRef = useMediaElementRef(videoPublication);
  const showVideo = Boolean(
    videoPublication?.enabled && videoPublication.track.readyState === "live",
  );

  return (
    <div
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
            "size-full object-cover",
            showVideo ? "opacity-100" : "absolute opacity-0",
          )}
        />
      ) : null}

      {showVideo ? null : (
        <div className="text-foreground-secondary grid place-items-center gap-2 text-center">
          {fallbackInitials ? (
            <span
              aria-hidden="true"
              className="bg-muted text-foreground grid size-12 place-items-center rounded-full font-medium"
            >
              {fallbackInitials}
            </span>
          ) : null}
          <span className="text-xs">{fallbackLabel}</span>
        </div>
      )}
    </div>
  );
}
