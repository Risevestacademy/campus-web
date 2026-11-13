import { useMemo } from "react";
import type { StoreApi } from "zustand/vanilla";

import { useMediaSessionStore } from "../services/media-session/media-session-provider";
import type { MediaSessionState } from "../services/media-session/media-session-store";
import type { MediaElementVolume } from "./use-media-element-ref";

// While an admin broadcasts, the space's call carries on this much quieter.
export const BROADCAST_DUCKED_GAIN = 0.25;

function isBroadcasting(state: MediaSessionState) {
  return Object.keys(state.broadcastPublications).length > 0;
}

// No gain means the call does not let you hear them: silent, never full
// volume. Somebody broadcasting is heard from the broadcast room only, so
// their voice never plays twice.
export function spaceCallVolume(
  state: MediaSessionState,
  participantId: string,
) {
  if (state.broadcastPublications[participantId]) return 0;
  const gain = state.remoteAudioGains[participantId] ?? 0;
  return isBroadcasting(state) ? gain * BROADCAST_DUCKED_GAIN : gain;
}

function remoteAudioVolume(
  store: StoreApi<MediaSessionState>,
  participantId: string,
): MediaElementVolume {
  const volumeOf = (state: MediaSessionState) =>
    spaceCallVolume(state, participantId);

  return {
    read: () => volumeOf(store.getState()),
    subscribe: (apply) =>
      store.subscribe((state, previous) => {
        if (volumeOf(state) !== volumeOf(previous)) apply(volumeOf(state));
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
