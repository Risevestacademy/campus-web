"use client";

import { cn } from "cn";
import { useCallback } from "react";

import type { MediaPublication } from "../services/media-session/contracts";

type MediaPublicationOutputProps = Readonly<{
  audioPublication?: MediaPublication;
  className?: string;
  fallbackInitials?: string;
  fallbackLabel: string;
  isLocal: boolean;
  label: string;
  outputDeviceId?: string;
  videoPublication?: MediaPublication;
}>;

function useMediaElementRef(
  publication: MediaPublication | undefined,
  outputDeviceId?: string,
) {
  return useCallback(
    (element: HTMLMediaElement | null) => {
      if (!element || !publication) return;

      element.srcObject = publication.stream;

      if (outputDeviceId !== undefined && "setSinkId" in element) {
        void element.setSinkId(outputDeviceId).catch(() => undefined);
      }

      return () => {
        if (element.srcObject === publication.stream) element.srcObject = null;
      };
    },
    [outputDeviceId, publication],
  );
}

export function MediaPublicationOutput({
  audioPublication,
  className,
  fallbackInitials,
  fallbackLabel,
  isLocal,
  label,
  outputDeviceId,
  videoPublication,
}: MediaPublicationOutputProps) {
  const videoRef = useMediaElementRef(videoPublication);
  const audioRef = useMediaElementRef(
    isLocal ? undefined : audioPublication,
    outputDeviceId,
  );
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

      {!isLocal && audioPublication ? (
        <audio ref={audioRef} autoPlay aria-label={`${label} audio`} />
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
