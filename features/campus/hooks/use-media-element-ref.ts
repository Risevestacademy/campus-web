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
// and never detaches what the member is hearing.
export function useMediaElementRef(
  publication: MediaPublication | undefined,
  outputDeviceId?: string,
  volume?: MediaElementVolume,
) {
  return useCallback(
    (element: HTMLMediaElement | null) => {
      if (!element || !publication) return;

      element.srcObject = publication.stream;

      if (outputDeviceId !== undefined && "setSinkId" in element) {
        void element.setSinkId(outputDeviceId).catch(() => undefined);
      }

      const stopFollowingVolume = volume && followVolume(element, volume);

      return () => {
        stopFollowingVolume?.();
        if (element.srcObject === publication.stream) element.srcObject = null;
      };
    },
    [outputDeviceId, publication, volume],
  );
}
