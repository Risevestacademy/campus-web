// eslint-disable-next-line no-restricted-imports -- External browser-resource lifecycle is intentionally isolated in this reusable hook.
import { useEffect } from "react";
import type { StoreApi } from "zustand/vanilla";

import type { MediaSessionState } from "./media-session-store";

export function useMediaSessionLifecycle(store: StoreApi<MediaSessionState>) {
  useEffect(() => {
    void store.getState().start();

    return () => store.getState().stop();
  }, [store]);
}
