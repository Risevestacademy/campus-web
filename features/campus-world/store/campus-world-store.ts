import { createStore, type StoreApi } from "zustand/vanilla";

import type { CampusWorldMapErrorKind } from "@/core/analytics/events";

export type CampusWorldStatus = "failed" | "idle" | "loading-map" | "ready";

interface CampusWorldFailure {
  errorKind: CampusWorldMapErrorKind;
  mapId: string | null;
}

export interface CampusWorldState {
  attempt: number;
  begin: () => number;
  errorKind: CampusWorldMapErrorKind | null;
  fail: (attempt: number, failure: CampusWorldFailure) => boolean;
  mapId: string | null;
  ready: (attempt: number, mapId: string) => void;
  status: CampusWorldStatus;
}

export type CampusWorldStore = StoreApi<CampusWorldState>;

export function createCampusWorldStore(): CampusWorldStore {
  return createStore<CampusWorldState>((set, get) => ({
    attempt: 0,
    begin() {
      const attempt = get().attempt + 1;
      set({
        attempt,
        errorKind: null,
        mapId: null,
        status: "loading-map",
      });
      return attempt;
    },
    errorKind: null,
    fail(attempt, failure) {
      const state = get();
      if (
        attempt !== state.attempt ||
        (state.status !== "loading-map" && state.status !== "ready")
      ) {
        return false;
      }

      set({ ...failure, status: "failed" });
      return true;
    },
    mapId: null,
    ready(attempt, mapId) {
      const state = get();
      if (attempt !== state.attempt || state.status !== "loading-map") {
        return;
      }

      set({ errorKind: null, mapId, status: "ready" });
    },
    status: "idle",
  }));
}
