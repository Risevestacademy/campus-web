import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import { presenceFor } from "@/core/presence";

import type { MeetingPresence } from "../services/meeting/meeting";

// What the meeting view and the chat panel read of presence. A selector that
// builds a fresh object each call would loop useSyncExternalStore: select the
// stable references, and let the caller derive.
export function useMeetingPresence(cohortId: string): MeetingPresence {
  return useStore(
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
}
