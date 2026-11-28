import { useMemo } from "react";

import { selectMeeting } from "../services/meeting/meeting";
import { useMeetingPresence } from "./use-meeting-presence";

export function useMeeting(cohortId: string) {
  const presence = useMeetingPresence(cohortId);

  return useMemo(() => selectMeeting(presence), [presence]);
}
