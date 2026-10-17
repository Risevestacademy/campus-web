import type { StoreApi } from "zustand/vanilla";

import type { MediaSessionState } from "../media-session/media-session-store";
import type { AdmissionStore } from "./admission-store";
import type { PresenceTab } from "./presence-tab";

// A tab that does not hold its cohort keeps no capture and no connection.
export function followPresenceTab(
  tab: PresenceTab,
  media: StoreApi<MediaSessionState>,
  admission: AdmissionStore,
): () => void {
  return tab.subscribe(() => {
    const status = tab.getStatus();

    if (status === "taken-over") admission.getState().clear();
    if (status === "taken-over" || status === "elsewhere") {
      media.getState().stop();
    } else {
      void media.getState().start();
    }
  });
}
