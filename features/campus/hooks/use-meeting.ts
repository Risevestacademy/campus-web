import { useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import { presenceFor } from "@/core/presence";

import { selectMeeting } from "../services/meeting/meeting";

// A selector that builds a fresh object each call would loop
// useSyncExternalStore: select the stable references, then derive.
export function useMeeting(cohortId: string) {
  const presence = useStore(
    presenceFor(cohortId),
    useShallow(
      ({
        selfId,
        participants,
        meetingRoster,
        encounter,
        hearing,
        spaceNames,
      }) => ({
        selfId,
        participants,
        meetingRoster,
        encounter,
        hearing,
        spaceNames,
      }),
    ),
  );

  return useMemo(() => selectMeeting(presence), [presence]);
}
