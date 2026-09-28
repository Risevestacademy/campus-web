import { cn } from "cn";

import { ButtonGroup, ButtonGroupSeparator } from "@/shared/ui/button-group";

import { AudioSettingsDropdown } from "./audio-settings-dropdown";
import { CameraSettingsDropdown } from "./camera-settings-dropdown";
import { MediaToggle } from "./media-toggle";

const mediaControlGroupClassName =
  "bg-surface rounded-2xl hover:ring-primary hover:ring-offset-background hover:ring hover:ring-offset-1";

export function MediaControls({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-fit items-center gap-6", className)}>
      <ButtonGroup
        aria-label="Camera controls"
        className={mediaControlGroupClassName}
      >
        <MediaToggle kind="video" />
        <ButtonGroupSeparator className="-ml-px" />
        <CameraSettingsDropdown />
      </ButtonGroup>

      <ButtonGroup
        aria-label="Microphone controls"
        className={mediaControlGroupClassName}
      >
        <MediaToggle kind="microphone" />
        <ButtonGroupSeparator className="-ml-px" />
        <AudioSettingsDropdown />
      </ButtonGroup>
    </div>
  );
}
