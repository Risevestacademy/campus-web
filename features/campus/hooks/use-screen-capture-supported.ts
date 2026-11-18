import { useSyncExternalStore } from "react";

import { supportsScreenCapture } from "../services/media-session/screen-share";

const subscribeToNothing = () => () => undefined;

// False on the server, so the first client render matches it.
export function useScreenCaptureSupported() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => supportsScreenCapture(navigator.mediaDevices),
    () => false,
  );
}
