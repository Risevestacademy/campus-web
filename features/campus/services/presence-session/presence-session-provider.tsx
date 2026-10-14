"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";
import { useStore } from "zustand";

import { useMountEffect } from "@/shared/lib/use-mount-effect";

import { MediaSessionProvider } from "../media-session/media-session-provider";
import { createMediaSessionStore } from "../media-session/media-session-store";
import { useMediaSessionLifecycle } from "../media-session/use-media-session-lifecycle";
import {
  type AdmissionState,
  type AdmissionStore,
  createAdmissionStore,
} from "./admission-store";
import { createBrowserPresenceTab } from "./browser-presence-tab";
import { followPresenceTab } from "./follow-presence-tab";
import type { PresenceTab, PresenceTabStatus } from "./presence-tab";

const AdmissionContext = createContext<AdmissionStore | null>(null);
const PresenceTabContext = createContext<PresenceTab | null>(null);

export function AdmissionProvider({
  children,
  store,
}: Readonly<{ children: ReactNode; store: AdmissionStore }>) {
  return (
    <AdmissionContext.Provider value={store}>
      {children}
    </AdmissionContext.Provider>
  );
}

export function PresenceTabProvider({
  children,
  tab,
}: Readonly<{ children: ReactNode; tab: PresenceTab }>) {
  return (
    <PresenceTabContext.Provider value={tab}>
      {children}
    </PresenceTabContext.Provider>
  );
}

function createPresenceSession(cohortId: string) {
  return {
    admission: createAdmissionStore(),
    media: createMediaSessionStore(),
    presenceTab: createBrowserPresenceTab(cohortId),
  };
}

export function PresenceSessionProvider({
  children,
  cohortId,
}: Readonly<{ children: ReactNode; cohortId: string }>) {
  const [session] = useState(() => createPresenceSession(cohortId));
  useMediaSessionLifecycle(session.media);
  useMountEffect(() => {
    const stopFollowing = followPresenceTab(
      session.presenceTab,
      session.media,
      session.admission,
    );
    const close = session.presenceTab.open();

    return () => {
      close();
      stopFollowing();
    };
  });

  return (
    <AdmissionProvider store={session.admission}>
      <MediaSessionProvider store={session.media}>
        <PresenceTabProvider tab={session.presenceTab}>
          {children}
        </PresenceTabProvider>
      </MediaSessionProvider>
    </AdmissionProvider>
  );
}

export function useAdmission<T>(selector: (state: AdmissionState) => T): T {
  const store = useContext(AdmissionContext);

  if (!store) {
    throw new Error("useAdmission must be used within AdmissionProvider.");
  }

  return useStore(store, selector);
}

// The server cannot see other tabs, so it renders as if still checking.
const getServerStatus = (): PresenceTabStatus => "checking";

export function usePresenceTab() {
  const tab = useContext(PresenceTabContext);

  if (!tab) {
    throw new Error("usePresenceTab must be used within PresenceTabProvider.");
  }

  const status = useSyncExternalStore(
    tab.subscribe,
    tab.getStatus,
    getServerStatus,
  );
  return { claim: tab.claim, status, takeOver: tab.takeOver };
}
