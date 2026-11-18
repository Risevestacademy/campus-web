import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import { presenceFor } from "@/core/presence";

import type { ChosenStatus } from "../services/status-choice/choose-status";

function chosenStatusOf(status: string | undefined): ChosenStatus {
  return status === "busy" || status === "away" ? status : "available";
}

// A new socket starts available, so that is what shows before the snapshot.
export function useOwnStatus(cohortId: string) {
  return useStore(
    presenceFor(cohortId),
    useShallow(({ selfId, participants, synced }) => {
      const self = selfId === null ? undefined : participants.get(selfId);
      return {
        status: chosenStatusOf(self?.status),
        statusUntil: self?.statusUntil ?? null,
        synced,
      };
    }),
  );
}
