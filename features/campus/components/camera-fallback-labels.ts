import type { CaptureStatus } from "../services/media-session/contracts";

// What a camera preview says in place of video, by capture status.
export const cameraFallbackLabels = {
  denied: "Camera permission denied",
  disabled: "Camera off",
  failed: "Camera unavailable",
  idle: "Starting camera…",
  ready: "Camera on",
  requesting: "Starting camera…",
  unavailable: "No camera available",
} as const satisfies Record<CaptureStatus, string>;
