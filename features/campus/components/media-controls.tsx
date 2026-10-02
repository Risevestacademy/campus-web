"use client";

import { cn } from "cn";

import { ButtonGroup, ButtonGroupSeparator } from "@/shared/ui/button-group";

import { useMediaSession } from "../services/media-session/media-session-provider";
import { AudioSettingsDropdown } from "./audio-settings-dropdown";
import { CameraSettingsDropdown } from "./camera-settings-dropdown";
import { MediaToggle } from "./media-toggle";

const mediaControlGroupClassName =
  "bg-surface rounded-xl hover:ring-primary h-10.75 hover:ring-offset-background hover:ring hover:ring-offset-1";

export function MediaControls({ className }: { className?: string }) {
  const camera = useMediaSession((state) => state.camera);
  const microphone = useMediaSession((state) => state.microphone);
  const output = useMediaSession((state) => state.output);
  const toggleSource = useMediaSession((state) => state.toggleSource);
  const errorMessage = [
    camera.error
      ? camera.track
        ? "Couldn't switch camera. The previous camera is still active."
        : "Camera unavailable. Use the camera control to retry."
      : null,
    microphone.error
      ? microphone.track
        ? "Couldn't switch microphone. The previous microphone is still active."
        : "Microphone unavailable. Use the microphone control to retry."
      : null,
    output.error
      ? "Speaker selection unavailable. Using the system default."
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="grid justify-items-center gap-1">
      <div className={cn("flex w-fit items-center gap-6", className)}>
        <ButtonGroup
          aria-label="Camera controls"
          className={mediaControlGroupClassName}
        >
          <MediaToggle
            isEnabled={camera.desiredEnabled && Boolean(camera.track)}
            kind="video"
            onToggle={() => toggleSource("camera")}
            status={camera.status}
          />
          <ButtonGroupSeparator className="-ml-px" />
          <CameraSettingsDropdown />
        </ButtonGroup>

        <ButtonGroup
          aria-label="Microphone controls"
          className={mediaControlGroupClassName}
        >
          <MediaToggle
            isEnabled={microphone.desiredEnabled && Boolean(microphone.track)}
            kind="microphone"
            onToggle={() => toggleSource("microphone")}
            status={microphone.status}
          />
          <ButtonGroupSeparator className="-ml-px" />
          <AudioSettingsDropdown />
        </ButtonGroup>
      </div>

      {errorMessage ? (
        <p role="status" aria-live="polite" className="text-error-icon text-xs">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
