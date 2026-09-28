"use client";

import { MicrophoneIcon } from "@phosphor-icons/react/dist/ssr/Microphone";
import { MicrophoneSlashIcon } from "@phosphor-icons/react/dist/ssr/MicrophoneSlash";
import { VideoCameraIcon } from "@phosphor-icons/react/dist/ssr/VideoCamera";
import { VideoCameraSlashIcon } from "@phosphor-icons/react/dist/ssr/VideoCameraSlash";
import { useState } from "react";

import { Button } from "@/shared/ui/button";

const mediaControls = {
  microphone: {
    DisabledIcon: MicrophoneSlashIcon,
    EnabledIcon: MicrophoneIcon,
    disableTitle: "Mute microphone",
    enableTitle: "Unmute microphone",
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

export function MediaToggle({ kind }: { kind: MediaKind }) {
  const [isEnabled, setIsEnabled] = useState(true);
  const { DisabledIcon, disableTitle, EnabledIcon, enableTitle, label } =
    mediaControls[kind];
  const title = isEnabled ? disableTitle : enableTitle;

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      aria-pressed={isEnabled}
      data-media-disabled={isEnabled ? undefined : ""}
      title={title}
      onClick={() => setIsEnabled((wasEnabled) => !wasEnabled)}
      className="group/media-toggle data-media-disabled:text-error-icon hover:bg-background data-media-disabled:hover:bg-error/10 transition-[background-color,color,scale,translate] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:transition-none active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span aria-hidden className="relative block size-5.5 shrink-0">
        <EnabledIcon
          data-slot={`${kind}-enabled-icon`}
          focusable="false"
          weight="regular"
          className="absolute inset-0 size-full scale-100 opacity-100 transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible/media-toggle:transition-none group-data-media-disabled/media-toggle:scale-[0.92] group-data-media-disabled/media-toggle:opacity-0 motion-reduce:transition-none"
        />
        <DisabledIcon
          data-slot={`${kind}-disabled-icon`}
          focusable="false"
          weight="regular"
          className="absolute inset-0 size-full scale-[0.92] opacity-0 transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible/media-toggle:transition-none group-data-media-disabled/media-toggle:scale-100 group-data-media-disabled/media-toggle:opacity-100 motion-reduce:transition-none"
        />
      </span>
    </Button>
  );
}
