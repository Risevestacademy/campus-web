import { useState } from "react";

import { presenceFor, statusTimeLeft } from "@/core/presence";
import { socialFor } from "@/core/realtime";
import { useNow } from "@/shared/lib/use-now";

import {
  chooseStatus,
  type ChosenStatus,
} from "../services/status-choice/choose-status";
import {
  durationSecondsOf,
  type StatusDurationId,
} from "../services/status-choice/status-durations";
import { useOwnStatus } from "./use-own-status";

const CLOCK_TICK_MS = 15_000;

// The member's own status and the choices that change it, for any control
// that offers them: the dock's tray and the rail's account menu.
export function useStatusChoice(cohortId: string) {
  const [durationId, setDurationId] = useState<StatusDurationId | null>(null);
  const { status, statusUntil, synced } = useOwnStatus(cohortId);
  const now = useNow(CLOCK_TICK_MS);
  const timeLeft = statusTimeLeft(statusUntil, now);

  function choose(next: ChosenStatus, forSeconds?: number) {
    return chooseStatus(
      {
        social: socialFor(cohortId),
        drawOwnStatus: presenceFor(cohortId).getState().drawOwnStatus,
        now: Date.now,
      },
      next,
      forSeconds,
    );
  }

  return {
    canChoose: synced,
    // A timer set before a reload has no chosen duration to show.
    durationId: timeLeft === null ? null : durationId,
    status,
    timeLeft,
    chooseDuration(next: StatusDurationId | null) {
      const forSeconds = next === null ? undefined : durationSecondsOf(next);
      if (choose(status, forSeconds)) setDurationId(next);
    },
    chooseStatus(next: ChosenStatus) {
      if (choose(next)) setDurationId(null);
    },
  };
}
