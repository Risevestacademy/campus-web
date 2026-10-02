"use client";

import { MicrophoneIcon } from "@phosphor-icons/react/dist/ssr/Microphone";
import { MicrophoneSlashIcon } from "@phosphor-icons/react/dist/ssr/MicrophoneSlash";
import { VideoCameraIcon } from "@phosphor-icons/react/dist/ssr/VideoCamera";
import { VideoCameraSlashIcon } from "@phosphor-icons/react/dist/ssr/VideoCameraSlash";
import { cn } from "cn";

import { Button } from "@/shared/ui/button";

import type {
  CaptureStatus,
  MediaSessionErrorCode,
} from "../services/media-session/contracts";

const mediaControls = {
  microphone: {
    DisabledIcon: MicrophoneSlashIcon,
    EnabledIcon: MicrophoneIcon,
    disableTitle: "Turn off microphone",
    enableTitle: "Turn on microphone",
    label: "Microphone",
  },
  video: {
    DisabledIcon: VideoCameraSlashIcon,
    EnabledIcon: VideoCameraIcon,
    disableTitle: "Turn off camera",
    enableTitle: "Turn on camera",
    label: "Camera",
  },
} as const;

type MediaKind = keyof typeof mediaControls;

type MediaToggleProps = Readonly<{
  error: MediaSessionErrorCode | null;
  isEnabled: boolean;
  kind: MediaKind;
  onToggle: () => Promise<void>;
  status: CaptureStatus;
}>;

const swapTransitionClassName =
  "transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible/media-toggle:transition-none";

function getSwapState(isVisible: boolean) {
  return isVisible ? "opacity-100" : "opacity-0";
}

function isToggleUnavailable(
  error: MediaSessionErrorCode | null,
  isEnabled: boolean,
) {
  if (isEnabled) return false;

  return (
    error === "permission-denied" ||
    error === "device-unavailable" ||
    error === "unsupported"
  );
}

function getEnableTitle(
  error: MediaSessionErrorCode | null,
  enableTitle: string,
  label: string,
) {
  switch (error) {
    case "permission-denied":
      return `${label} access blocked`;
    case "device-unavailable":
      return `${label} unavailable`;
    case "unsupported":
      return `${label} unsupported`;
    case "device-unreadable":
    case "unknown":
      return `Try ${label.toLowerCase()} again`;
    default:
      return enableTitle;
  }
}

export function MediaToggle({
  error,
  isEnabled,
  kind,
  onToggle,
  status,
}: MediaToggleProps) {
  const { DisabledIcon, disableTitle, EnabledIcon, enableTitle, label } =
    mediaControls[kind];
  const isInteractionDisabled = isToggleUnavailable(error, isEnabled);
  const title =
    status === "requesting"
      ? `Starting ${label.toLowerCase()}`
      : isEnabled
        ? disableTitle
        : getEnableTitle(error, enableTitle, label);

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={title}
      aria-pressed={isEnabled}
      aria-busy={status === "requesting"}
      disabled={isInteractionDisabled}
      data-media-state={isEnabled ? "on" : "off"}
      data-media-status={status}
      title={title}
      onClick={() => void onToggle()}
      className="group/media-toggle data-[media-state=off]:text-error-icon hover:bg-muted data-[media-state=off]:hover:bg-error/10 disabled:text-muted-foreground! transition-[background-color,color,scale,translate] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:transition-none active:scale-[0.97] disabled:opacity-100 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span aria-hidden className="relative block size-5.5 shrink-0">
        <EnabledIcon
          data-slot={`${kind}-enabled-icon`}
          focusable="false"
          weight="regular"
          className={cn(
            "absolute inset-0 size-full",
            swapTransitionClassName,
            getSwapState(isEnabled),
          )}
        />
        <DisabledIcon
          data-slot={`${kind}-disabled-icon`}
          focusable="false"
          weight="regular"
          className={cn(
            "absolute inset-0 size-full",
            swapTransitionClassName,
            getSwapState(!isEnabled),
          )}
        />
        <span
          data-slot={`${kind}-blocked-badge`}
          className={cn(
            "bg-warning ring-surface absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2",
            swapTransitionClassName,
            getSwapState(isInteractionDisabled),
          )}
        />
      </span>
    </Button>
  );
}
