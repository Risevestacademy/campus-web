"use client";

import { MicrophoneIcon } from "@phosphor-icons/react/dist/ssr/Microphone";
import { MicrophoneSlashIcon } from "@phosphor-icons/react/dist/ssr/MicrophoneSlash";
import { VideoCameraIcon } from "@phosphor-icons/react/dist/ssr/VideoCamera";
import { VideoCameraSlashIcon } from "@phosphor-icons/react/dist/ssr/VideoCameraSlash";
import { cn } from "cn";

import { Button } from "@/shared/ui/button";

import { useMicrophoneLevelRef } from "../hooks/use-microphone-level-ref";
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
  onToggle: () => Promise<void>;
  status: CaptureStatus;
}> &
  (
    | Readonly<{ kind: "microphone"; levelTrack?: MediaStreamTrack | null }>
    | Readonly<{ kind: Exclude<MediaKind, "microphone"> }>
  );

const swapTransitionClassName =
  "transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible/media-toggle:transition-none";

// The capsule of Phosphor's filled microphone (y 16-176 of its 256 box), so
// the level fills the capsule and never the stand. Under reduced motion the
// fill gives way to a colour change while speaking.
const MICROPHONE_CAPSULE_PATH =
  "M80,128V64a48,48,0,0,1,96,0v64a48,48,0,0,1-96,0Z";
const levelFillClassName =
  "text-success-icon absolute inset-0 size-full [clip-path:inset(calc(6.25%_+_(1_-_var(--mic-level,0))_*_62.5%)_0_0_0)] motion-reduce:hidden";
const speakingColorClassName =
  "motion-reduce:group-data-[speaking=true]/mic-level:text-success-icon";

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

function meteredTrackOf(props: MediaToggleProps) {
  return props.isEnabled && props.kind === "microphone"
    ? (props.levelTrack ?? null)
    : null;
}

export function MediaToggle(props: MediaToggleProps) {
  const { error, isEnabled, kind, onToggle, status } = props;
  const { DisabledIcon, disableTitle, EnabledIcon, enableTitle, label } =
    mediaControls[kind];
  const isInteractionDisabled = isToggleUnavailable(error, isEnabled);
  const meteredTrack = meteredTrackOf(props);
  const levelRef = useMicrophoneLevelRef(meteredTrack);
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
      <span
        ref={levelRef}
        aria-hidden
        className="group/mic-level relative block size-5.5 shrink-0"
      >
        {meteredTrack ? (
          <svg
            data-slot="microphone-level"
            viewBox="0 0 256 256"
            fill="currentColor"
            focusable="false"
            className={levelFillClassName}
          >
            <path d={MICROPHONE_CAPSULE_PATH} />
          </svg>
        ) : null}
        <EnabledIcon
          data-slot={`${kind}-enabled-icon`}
          focusable="false"
          weight="regular"
          className={cn(
            "absolute inset-0 size-full",
            swapTransitionClassName,
            getSwapState(isEnabled),
            meteredTrack && speakingColorClassName,
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
