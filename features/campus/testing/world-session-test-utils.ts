import type { RealtimeOutcome, RealtimeStatus } from "@/core/realtime";

import type { WorldSession } from "../services/world-session/world-session";

export type TestWorldSession = WorldSession &
  Readonly<{
    connects: () => number;
    reconnects: () => number;
    stop: (outcome: RealtimeOutcome) => void;
    setStatus: (status: RealtimeStatus) => void;
  }>;

// A world session with the real connect rules and no socket: connect starts
// from idle only, reconnect from anywhere. The test plays world with stop.
export function createTestWorldSession(
  initialStatus: RealtimeStatus = { phase: "idle" },
): TestWorldSession {
  const listeners = new Set<() => void>();
  let status = initialStatus;
  let connects = 0;
  let reconnects = 0;

  function setStatus(next: RealtimeStatus) {
    status = next;
    for (const listener of listeners) listener();
  }

  return {
    close: () => setStatus({ phase: "idle" }),
    connect() {
      if (status.phase !== "idle") return;
      connects += 1;
      setStatus({ phase: "connected" });
    },
    connects: () => connects,
    getStatus: () => status,
    reconnect() {
      reconnects += 1;
      setStatus({ phase: "connected" });
    },
    reconnects: () => reconnects,
    rejoin: () => status.phase === "connected",
    setStatus,
    stop: (outcome) => setStatus({ phase: "closed", outcome }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
