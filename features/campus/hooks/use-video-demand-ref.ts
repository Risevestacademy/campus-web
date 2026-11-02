import { useCallback } from "react";

import type { VideoLayer } from "../services/media-session/contracts";
import { useMediaSession } from "../services/media-session/media-session-provider";

// A mounted tile asks for its participant's camera and lets it go on unmount,
// so only cameras on screen subscribe.
export function useVideoDemandRef(participantId: string, layer: VideoLayer) {
  const demandVideo = useMediaSession((state) => state.demandVideo);

  return useCallback(
    (element: HTMLElement | null) =>
      element ? demandVideo(participantId, layer) : undefined,
    [demandVideo, layer, participantId],
  );
}
