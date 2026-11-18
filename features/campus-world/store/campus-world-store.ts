import { createStore, type StoreApi } from "zustand/vanilla";

export type CampusWorldStatus = "failed" | "idle" | "loading-map" | "ready";

export interface CampusWorldState {
  attempt: number;
  begin: () => number;
  fail: (attempt: number, mapId: string | null) => boolean;
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
      set({ attempt, mapId: null, status: "loading-map" });
      return attempt;
    },
    fail(attempt, mapId) {
      const state = get();
      if (
        attempt !== state.attempt ||
        (state.status !== "loading-map" && state.status !== "ready")
      ) {
        return false;
      }

      set({ mapId, status: "failed" });
      return true;
    },
    mapId: null,
    ready(attempt, mapId) {
      const state = get();
      if (attempt !== state.attempt || state.status !== "loading-map") {
        return;
      }

      set({ mapId, status: "ready" });
    },
    status: "idle",
  }));
}
