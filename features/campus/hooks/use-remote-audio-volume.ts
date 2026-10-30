import { useMemo } from "react";
import type { StoreApi } from "zustand/vanilla";

import { useMediaSessionStore } from "../services/media-session/media-session-provider";
import type { MediaSessionState } from "../services/media-session/media-session-store";
import type { MediaElementVolume } from "./use-media-element-ref";

// No gain means the call does not let you hear them: silent, never full volume.
function remoteAudioVolume(
  store: StoreApi<MediaSessionState>,
  participantId: string,
): MediaElementVolume {
  const gainOf = (state: MediaSessionState) =>
    state.remoteAudioGains[participantId] ?? 0;

  return {
    read: () => gainOf(store.getState()),
    subscribe: (apply) =>
      store.subscribe((state, previous) => {
        if (gainOf(state) !== gainOf(previous)) apply(gainOf(state));
      }),
  };
}

export function useRemoteAudioVolume(participantId: string) {
  const store = useMediaSessionStore();
  return useMemo(
    () => remoteAudioVolume(store, participantId),
    [store, participantId],
  );
}
