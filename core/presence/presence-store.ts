import { createStore, type StoreApi } from "zustand/vanilla";

import type { ServerMessage } from "@/core/realtime";

import { applyServerMessage, EMPTY_PRESENCE, type Presence } from "./presence";

export interface PresenceState extends Presence {
  apply: (message: ServerMessage) => void;
  clear: () => void;
}

export type PresenceStore = StoreApi<PresenceState>;

export function createPresenceStore(): PresenceStore {
  return createStore<PresenceState>((set, get) => ({
    ...EMPTY_PRESENCE,
    apply(message) {
      const current = get();
      const next = applyServerMessage(current, message);
      if (next !== current) set(next);
    },
    clear: () => set(EMPTY_PRESENCE),
  }));
}

// One per cohort per document, like the Presence Session that feeds it. It
// outlives the map's mount, so returning from the meeting page draws everyone.
const cohortStores = new Map<string, PresenceStore>();

export function presenceFor(cohortId: string): PresenceStore {
  let store = cohortStores.get(cohortId);
  if (!store) {
    store = createPresenceStore();
    cohortStores.set(cohortId, store);
  }
  return store;
}
