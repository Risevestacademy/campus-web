"use client";

import { useMediaSession } from "../services/media-session/media-session-provider";
import { MediaControls } from "./media-controls";
import { MediaPublicationOutput } from "./media-publication-output";

const cameraFallbackLabels = {
  denied: "Camera permission denied",
  disabled: "Camera off",
  failed: "Camera unavailable",
  idle: "Starting camera…",
  ready: "Camera on",
  requesting: "Starting camera…",
  unavailable: "No camera available",
} as const;

export function VisualsDisplay() {
  const cameraPublication = useMediaSession(
    (state) => state.localPublications.camera,
  );
  const cameraStatus = useMediaSession((state) => state.camera.status);

  return (
    <section className="relative flex flex-col items-center justify-center">
      <figure className="bg-surface aspect-4/3 w-full max-w-160 overflow-hidden">
        <MediaPublicationOutput
          fallbackLabel={cameraFallbackLabels[cameraStatus]}
          isLocal
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
