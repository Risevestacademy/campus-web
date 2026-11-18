"use client";

import { createContext, type ReactNode, useContext } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";

import type { MediaSessionState } from "./media-session-store";

const MediaSessionContext = createContext<StoreApi<MediaSessionState> | null>(
  null,
);

type MediaSessionProviderProps = Readonly<{
  children: ReactNode;
  store: StoreApi<MediaSessionState>;
}>;

export function MediaSessionProvider({
  children,
  store,
}: MediaSessionProviderProps) {
  return (
    <MediaSessionContext.Provider value={store}>
      {children}
    </MediaSessionContext.Provider>
  );
}

export function useMediaSessionStore() {
  const store = useContext(MediaSessionContext);

  if (!store) {
    throw new Error(
      "useMediaSession must be used within MediaSessionProvider.",
    );
  }

  return store;
}

export function useMediaSession<T>(
  selector: (state: MediaSessionState) => T,
): T {
  const store = useMediaSessionStore();
  return useStore(store, selector);
}
