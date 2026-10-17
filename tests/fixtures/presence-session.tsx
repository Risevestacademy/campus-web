import type { ReactNode } from "react";
import type { StoreApi } from "zustand/vanilla";

import { MediaSessionProvider } from "@/features/campus/services/media-session/media-session-provider";
import {
  createMediaSessionStore,
  type MediaSessionState,
} from "@/features/campus/services/media-session/media-session-store";
import {
  type AdmissionStore,
  createAdmissionStore,
} from "@/features/campus/services/presence-session/admission-store";
import {
  AdmissionProvider,
  PresenceTabProvider,
} from "@/features/campus/services/presence-session/presence-session-provider";
import type { PresenceTab } from "@/features/campus/services/presence-session/presence-tab";
import { createTestPresenceTab } from "@/features/campus/testing/presence-tab-test-utils";

export function createPresenceMediaTestStore() {
  return createMediaSessionStore();
}

export function createPresenceAdmissionTestStore() {
  return createAdmissionStore();
}

export function createAdmittedTestStore(destination = "/campus/c-1") {
  const store = createAdmissionStore();
  store.getState().grantEntry(destination);
  store.getState().completeEntry(destination);
  return store;
}

// Stands in for app/campus/[id]/layout.tsx with stores a test can observe.
export function presenceSession(
  children: ReactNode,
  mediaStore: StoreApi<MediaSessionState> = createPresenceMediaTestStore(),
  admissionStore: AdmissionStore = createPresenceAdmissionTestStore(),
  presenceTab: PresenceTab = createTestPresenceTab(),
) {
  return (
    <AdmissionProvider store={admissionStore}>
      <MediaSessionProvider store={mediaStore}>
        <PresenceTabProvider tab={presenceTab}>{children}</PresenceTabProvider>
      </MediaSessionProvider>
    </AdmissionProvider>
  );
}
