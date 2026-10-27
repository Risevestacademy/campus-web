import { useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import { presenceFor } from "@/core/presence";

import { selectProximityMeeting } from "../services/proximity-meeting/proximity-meeting";

// A selector that builds a fresh object each call would loop
// useSyncExternalStore: select the stable references, then derive.
export function useProximityMeeting(cohortId: string) {
  const presence = useStore(
    presenceFor(cohortId),
    useShallow(({ selfId, participants, nearby, encounter }) => ({
      selfId,
      participants,
      nearby,
      encounter,
    })),
  );

  return useMemo(() => selectProximityMeeting(presence), [presence]);
}
