"use client";

import { cn } from "cn";

import { ButtonGroup, ButtonGroupSeparator } from "@/shared/ui/button-group";

import type { CaptureSource } from "../services/media-session/contracts";
import { useMediaSession } from "../services/media-session/media-session-provider";
import { AudioSettingsDropdown } from "./audio-settings-dropdown";
import { CameraSettingsDropdown } from "./camera-settings-dropdown";
import { reportSourceResult } from "./media-error-feedback";
import { MediaToggle } from "./media-toggle";

const mediaControlGroupClassName =
  "bg-surface rounded-xl h-10.75 hover:has-enabled:ring hover:has-enabled:ring-primary hover:has-enabled:ring-offset-1 hover:has-enabled:ring-offset-background";

export function MediaControls({ className }: { className?: string }) {
  const camera = useMediaSession((state) => state.camera);
  const microphone = useMediaSession((state) => state.microphone);
  const toggleSource = useMediaSession((state) => state.toggleSource);

  async function handleToggle(source: CaptureSource) {
    reportSourceResult(source, await toggleSource(source));
  }

  return (
    <div className="grid justify-items-center gap-1">
      <div className={cn("flex w-fit items-center gap-6", className)}>
        <ButtonGroup
          aria-label="Camera controls"
          className={mediaControlGroupClassName}
        >
          <MediaToggle
            error={camera.error}
            isEnabled={camera.desiredEnabled && Boolean(camera.track)}
            kind="video"
            onToggle={() => handleToggle("camera")}
            status={camera.status}
          />
          <ButtonGroupSeparator className="-ml-px" />
          <CameraSettingsDropdown onRetry={() => handleToggle("camera")} />
        </ButtonGroup>

        <ButtonGroup
          aria-label="Microphone controls"
          className={mediaControlGroupClassName}
        >
          <MediaToggle
            error={microphone.error}
            isEnabled={microphone.desiredEnabled && Boolean(microphone.track)}
            kind="microphone"
            onToggle={() => handleToggle("microphone")}
            status={microphone.status}
          />
          <ButtonGroupSeparator className="-ml-px" />
          <AudioSettingsDropdown onRetry={() => handleToggle("microphone")} />
        </ButtonGroup>
      </div>
    </div>
  );
}
