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
    disableLabel: "Mute microphone",
    enableLabel: "Unmute microphone",
  },
  video: {
    DisabledIcon: VideoCameraSlashIcon,
    EnabledIcon: VideoCameraIcon,
    disableLabel: "Turn off camera",
    enableLabel: "Turn on camera",
  },
} as const;

type MediaKind = keyof typeof mediaControls;

export function MediaToggle({ kind }: { kind: MediaKind }) {
  const [isDisabled, setIsDisabled] = useState(false);
  const { DisabledIcon, disableLabel, EnabledIcon, enableLabel } =
    mediaControls[kind];
  const label = isDisabled ? enableLabel : disableLabel;

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      aria-pressed={isDisabled}
      title={label}
      onClick={() => setIsDisabled((wasDisabled) => !wasDisabled)}
      className="group/media-toggle aria-pressed:text-error-icon aria-pressed:hover:bg-error-subtle transition-[background-color,color,scale,translate] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:transition-none active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:translate-y-0 motion-reduce:active:scale-100"
    >
      <span aria-hidden className="relative block size-5 shrink-0">
        <EnabledIcon
          data-slot={`${kind}-enabled-icon`}
          focusable="false"
          weight="regular"
          className="absolute inset-0 size-full scale-100 opacity-100 transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible/media-toggle:transition-none group-aria-pressed/media-toggle:scale-[0.92] group-aria-pressed/media-toggle:opacity-0 motion-reduce:transition-none"
        />
        <DisabledIcon
          data-slot={`${kind}-disabled-icon`}
          focusable="false"
          weight="regular"
          className="absolute inset-0 size-full scale-[0.92] opacity-0 transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible/media-toggle:transition-none group-aria-pressed/media-toggle:scale-100 group-aria-pressed/media-toggle:opacity-100 motion-reduce:transition-none"
        />
      </span>
    </Button>
  );
}
