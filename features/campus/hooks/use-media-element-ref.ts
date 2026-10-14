import { useCallback } from "react";

import type { MediaPublication } from "../services/media-session/contracts";

export function useMediaElementRef(
  publication: MediaPublication | undefined,
  outputDeviceId?: string,
) {
  return useCallback(
    (element: HTMLMediaElement | null) => {
      if (!element || !publication) return;

      element.srcObject = publication.stream;

      if (outputDeviceId !== undefined && "setSinkId" in element) {
        void element.setSinkId(outputDeviceId).catch(() => undefined);
      }

      return () => {
        if (element.srcObject === publication.stream) element.srcObject = null;
      };
    },
    [outputDeviceId, publication],
  );
}
