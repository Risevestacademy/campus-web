import { useCallback } from "react";

import { browserMicrophoneLevelMeter } from "../services/microphone-level/browser-microphone-level";
import type { MicrophoneLevelMeter } from "../services/microphone-level/microphone-level-meter";

const LEVEL_PROPERTY = "--mic-level";

// Writes every frame straight to the element: React never re-renders for a
// level, and the callback depends on the track alone, so it never re-attaches.
export function useMicrophoneLevelRef(
  track: MediaStreamTrack | null,
  meter: MicrophoneLevelMeter = browserMicrophoneLevelMeter,
) {
  return useCallback(
    (element: HTMLElement | null) => {
      if (!element || !track) return;

      const stopFollowing = meter.follow(track, (level, speaking) => {
        element.style.setProperty(LEVEL_PROPERTY, level.toFixed(3));
        element.dataset.speaking = String(speaking);
      });

      return () => {
        stopFollowing();
        element.style.removeProperty(LEVEL_PROPERTY);
        delete element.dataset.speaking;
      };
    },
    [meter, track],
  );
}
