import { ButtonGroup, ButtonGroupSeparator } from "@/shared/ui/button-group";

import { AudioSettingsDropdown } from "./audio-settings-dropdown";
import { CameraSettingsDropdown } from "./camera-settings-dropdown";
import { MediaToggle } from "./media-toggle";

export function MediaControls() {
  return (
    <div className="*:bg-surface flex w-fit items-center gap-6">
      <ButtonGroup aria-label="Camera controls">
        <MediaToggle kind="video" />
        <ButtonGroupSeparator className="-ml-px" />
        <CameraSettingsDropdown />
      </ButtonGroup>

      <ButtonGroup aria-label="Microphone controls">
        <MediaToggle kind="microphone" />
        <ButtonGroupSeparator className="-ml-px" />
        <AudioSettingsDropdown />
      </ButtonGroup>
    </div>
  );
}
