import { useCallback } from "react";

import type {
  VideoLayer,
  VideoSource,
} from "../services/media-session/contracts";
import { useMediaSession } from "../services/media-session/media-session-provider";

// A mounted tile asks for its participant's video and lets it go on unmount,
// so only videos on screen subscribe.
export function useVideoDemandRef(
  participantId: string,
  source: VideoSource,
  layer: VideoLayer,
) {
  const demandVideo = useMediaSession((state) => state.demandVideo);

  return useCallback(
    (element: HTMLElement | null) =>
      element ? demandVideo(participantId, source, layer) : undefined,
    [demandVideo, layer, participantId, source],
  );
}
