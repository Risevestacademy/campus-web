"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";

import {
  createMediaSessionStore,
  type MediaSessionState,
} from "./media-session-store";
import { useMediaSessionLifecycle } from "./use-media-session-lifecycle";

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

export function CampusMediaSessionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [store] = useState(createMediaSessionStore);
  useMediaSessionLifecycle(store);

  return <MediaSessionProvider store={store}>{children}</MediaSessionProvider>;
}

function useMediaSessionStore() {
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
