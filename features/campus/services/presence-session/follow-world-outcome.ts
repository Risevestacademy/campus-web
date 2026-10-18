import type { StoreApi } from "zustand/vanilla";

import type { RealtimeOutcome } from "@/core/realtime";

import type { MediaSessionState } from "../media-session/media-session-store";
import type { AdmissionStore } from "./admission-store";
import type { PresenceTab } from "./presence-tab";

export interface DocumentNavigation {
  reloadDocument: () => void;
  replaceDocument: (href: string) => void;
}

const COHORT_PICKER = "/campus";

// World refusing the member is decided again by the route guard: a reload
// lands on pre-join at worst, since Admission is never persisted, so it
// cannot loop. gave-up and stop leave the call alone; the map's status says so.
export function followWorldOutcome(
  media: StoreApi<MediaSessionState>,
  admission: AdmissionStore,
  presenceTab: Pick<PresenceTab, "releaseToAnotherDevice">,
  navigation: DocumentNavigation,
): (outcome: RealtimeOutcome) => Promise<void> {
  return async (outcome) => {
    switch (outcome) {
      case "entered-elsewhere":
        media.getState().stop();
        admission.getState().clear();
        await presenceTab.releaseToAnotherDevice();
        return;
      case "choose-cohort":
        return navigation.replaceDocument(COHORT_PICKER);
      case "sign-in":
      case "onboarding":
      case "sign-out":
        return navigation.reloadDocument();
      case "gave-up":
      case "stop":
        return;
    }
  };
}
