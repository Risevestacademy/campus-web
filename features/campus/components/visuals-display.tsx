"use client";

import { useDeviceAccessRequest } from "../hooks/use-device-access-request";
import { useMediaSession } from "../services/media-session/media-session-provider";
import { cameraFallbackLabels } from "./camera-fallback-labels";
import { MediaControls } from "./media-controls";
import { MediaPublicationOutput } from "./media-publication-output";

export function VisualsDisplay() {
  useDeviceAccessRequest();
  const cameraPublication = useMediaSession(
    (state) => state.localPublications.camera,
  );
  const cameraStatus = useMediaSession((state) => state.camera.status);

  return (
    <section className="relative flex flex-col items-center justify-center">
      <figure className="bg-surface aspect-4/3 w-full max-w-160 overflow-hidden">
        <MediaPublicationOutput
          fallbackLabel={cameraFallbackLabels[cameraStatus]}
          label="Camera preview"
          videoPublication={cameraPublication}
        />
      </figure>

      <div className="absolute bottom-3">
        <MediaControls />
      </div>
    </section>
  );
}
