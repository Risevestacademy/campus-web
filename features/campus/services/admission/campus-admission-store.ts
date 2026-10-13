import { createStore, type StoreApi } from "zustand/vanilla";

export type CampusAdmissionState = Readonly<{
  admittedCohortId: string | null;
  completeActiveCampusEntry: (cohortId: string, destination: string) => void;
  grantActiveCampusEntry: (destination: string) => void;
  pendingActiveCampusDestination: string | null;
}>;

export type CampusAdmissionStore = StoreApi<CampusAdmissionState>;

export function createCampusAdmissionStore(): CampusAdmissionStore {
  return createStore<CampusAdmissionState>((set) => ({
    admittedCohortId: null,
    completeActiveCampusEntry(cohortId, destination) {
      set((state) =>
        state.pendingActiveCampusDestination === destination
          ? {
              admittedCohortId: cohortId,
              pendingActiveCampusDestination: null,
            }
          : state,
      );
    },
    grantActiveCampusEntry(destination) {
      set({ pendingActiveCampusDestination: destination });
    },
    pendingActiveCampusDestination: null,
  }));
}
