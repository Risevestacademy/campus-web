import type { ReactNode } from "react";
import { vi } from "vitest";
import type { StoreApi } from "zustand/vanilla";

import ActiveCampusLayout from "@/app/campus/[id]/(media-session)/(active-campus)/layout";
import MediaSessionLayout from "@/app/campus/[id]/(media-session)/layout";
import { CampusAdmissionProvider } from "@/features/campus/services/admission/campus-admission-provider";
import {
  type CampusAdmissionStore,
  createCampusAdmissionStore,
} from "@/features/campus/services/admission/campus-admission-store";
import { MediaSessionProvider } from "@/features/campus/services/media-session/media-session-provider";
import {
  createMediaSessionStore,
  type MediaSessionState,
} from "@/features/campus/services/media-session/media-session-store";

vi.mock(
  "next/navigation",
  () => import("@/tests/fixtures/active-campus-navigation-stub"),
);

const params = Promise.resolve({ id: "c-1" });

// Layouts are async Server Components; RTL renders only what they resolve to.
// Pair with the route-access stub, since the layouts read the session.
export function createActiveCampusTestStore() {
  return createMediaSessionStore();
}

export function createActiveCampusAdmissionTestStore() {
  return createCampusAdmissionStore();
}

export async function mediaSessionLayout(
  children: ReactNode,
  store?: StoreApi<MediaSessionState>,
  admissionStore: CampusAdmissionStore = createActiveCampusAdmissionTestStore(),
) {
  const mediaSession = store ? (
    <MediaSessionProvider store={store}>{children}</MediaSessionProvider>
  ) : (
    await MediaSessionLayout({ children, params })
  );

  return (
    <CampusAdmissionProvider store={admissionStore}>
      {mediaSession}
    </CampusAdmissionProvider>
  );
}

export async function activeCampusLayout(
  children: ReactNode = <div />,
  store = createActiveCampusTestStore(),
  admissionStore = createActiveCampusAdmissionTestStore(),
) {
  if (admissionStore.getState().pendingActiveCampusDestination === null) {
    admissionStore.getState().grantActiveCampusEntry("/campus/c-1");
  }

  return mediaSessionLayout(
    await ActiveCampusLayout({ children, params }),
    store,
    admissionStore,
  );
}
