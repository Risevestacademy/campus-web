"use client";

import { isManuallyRecoverable, type RealtimeStatus } from "@/core/realtime";
import { Button } from "@/shared/ui/button";

import { useWorldSession } from "../services/world-session/world-session-provider";

// A sub-second blip retries once and shows nothing; only a failed retry does.
const QUIET_RETRIES = 1;

function isRetryingAgain(status: RealtimeStatus) {
  return (
    (status.phase === "reconnecting" || status.phase === "connecting") &&
    status.attempt > QUIET_RETRIES
  );
}

function isOffline(status: RealtimeStatus) {
  return status.phase === "closed" && isManuallyRecoverable(status.outcome);
}

// The live region stays mounted so screen readers hear what appears in it.
export function WorldConnectionStatus() {
  const { reconnect, status } = useWorldSession();

  return (
    <div className="flex items-center gap-3 empty:hidden" role="status">
      {isRetryingAgain(status) ? (
        <p className="bg-background/90 rounded-full px-3 py-1.5 text-sm">
          Reconnecting to campus…
        </p>
      ) : null}
      {isOffline(status) ? (
        <>
          <p className="bg-background/90 rounded-full px-3 py-1.5 text-sm">
            You&apos;re offline in the campus
          </p>
          <Button onClick={reconnect} size="sm" type="button">
            Reconnect
          </Button>
        </>
      ) : null}
    </div>
  );
}
