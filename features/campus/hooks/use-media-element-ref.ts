import { useCallback } from "react";

import type { MediaPublication } from "../services/media-session/contracts";

export type MediaElementVolume = Readonly<{
  read: () => number;
  subscribe: (apply: (volume: number) => void) => () => void;
}>;

function followVolume(element: HTMLMediaElement, volume: MediaElementVolume) {
  element.volume = volume.read();
  return volume.subscribe((next) => {
    element.volume = next;
  });
}

// Volume is followed outside React, so a gain change never re-runs this ref
// and never detaches what the member is hearing. Neither does a handover of
// the same stream, such as a mute: re-attaching would clip the audio.
export function useMediaElementRef(
  publication: MediaPublication | undefined,
  outputDeviceId?: string,
  volume?: MediaElementVolume,
) {
  const stream = publication?.stream;
  return useCallback(
    (element: HTMLMediaElement | null) => {
      if (!element || !stream) return;

      element.srcObject = stream;

      if (outputDeviceId !== undefined && "setSinkId" in element) {
        void element.setSinkId(outputDeviceId).catch(() => undefined);
      }

      const stopFollowingVolume = volume && followVolume(element, volume);

      return () => {
        stopFollowingVolume?.();
        if (element.srcObject === stream) element.srcObject = null;
      };
    },
    [outputDeviceId, stream, volume],
  );
}
