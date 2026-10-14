import { createStore, type StoreApi } from "zustand/vanilla";

export type AdmissionState = Readonly<{
  admitted: boolean;
  completeEntry: (destination: string) => void;
  grantEntry: (destination: string) => void;
  pendingDestination: string | null;
}>;

export type AdmissionStore = StoreApi<AdmissionState>;

export function createAdmissionStore(): AdmissionStore {
  return createStore<AdmissionState>((set) => ({
    admitted: false,
    completeEntry(destination) {
      set((state) =>
        state.pendingDestination === destination
          ? { admitted: true, pendingDestination: null }
          : state,
      );
    },
    grantEntry(destination) {
      set({ pendingDestination: destination });
    },
    pendingDestination: null,
  }));
}
