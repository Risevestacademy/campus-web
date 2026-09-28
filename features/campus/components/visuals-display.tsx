import { ButtonGroup, ButtonGroupSeparator } from "@/shared/ui/button-group";

import { AudioSettingsDropdown } from "./audio-settings-dropdown";
import { CameraSettingsDropdown } from "./camera-settings-dropdown";
import { MediaToggle } from "./media-toggle";

export function VisualsDisplay() {
  return (
    <section className="relative flex flex-col items-center justify-center">
      <figure className="bg-surface aspect-4/3 w-full max-w-160"></figure>

      <div className="*:bg-surface absolute bottom-3 flex w-fit items-center gap-6">
        <ButtonGroup>
          <MediaToggle kind="video" />
          <ButtonGroupSeparator className="-ml-px" />
          <CameraSettingsDropdown />
        </ButtonGroup>

        <ButtonGroup>
          <MediaToggle kind="microphone" />
          <ButtonGroupSeparator className="-ml-px" />
          <AudioSettingsDropdown />
        </ButtonGroup>
      </div>
    </section>
  );
}
