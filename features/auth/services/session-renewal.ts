import { cooldownAfter } from "./refresh-cooldown";
import type { Serialize, SessionRefresh } from "./session.service";

const MAX_LEAD_MS = 120_000;
const LIFETIME_SHARE_AS_LEAD = 4;
// setTimeout fires at once above 2^31-1 ms (~24.8 days), which would turn a
// far-future expiry into a renewal loop. Long waits re-check in steps instead.
const MAX_TIMER_MS = 2_147_483_647;

export interface RenewalOutcome {
  kind: "renewed" | "expired" | "lapsed";
  failedAttempts: number;
}

export interface SharedExpiry {
  read(): number | undefined;
  write(expiresAt: number): void;
  subscribe(listener: (expiresAt: number) => void): () => void;
}

export interface SessionRenewalPorts {
  refresh: () => Promise<SessionRefresh>;
  withLock: Serialize;
  sharedExpiry: SharedExpiry;
  subscribeToWake: (listener: () => void) => () => void;
  report: (outcome: RenewalOutcome) => void;
}

type Attempt = SessionRefresh | { kind: "shared"; expiresAt: number };

interface Plan {
  expiresAt: number;
  dueAt: number;
}

function planRenewal(expiresAt: number, now: number): Plan {
  const lead = Math.min(
    MAX_LEAD_MS,
    Math.max(0, expiresAt - now) / LIFETIME_SHARE_AS_LEAD,
  );
  return { expiresAt, dueAt: expiresAt - lead };
}

function runRenewal(ports: SessionRenewalPorts, seed: number): () => void {
  let plan: Plan | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failedAttempts = 0;
  let lapsed = false;
  let renewing = false;
  let stopped = false;

  function adopt(expiresAt: number) {
    if (stopped || (plan && expiresAt <= plan.expiresAt)) return;
    plan = planRenewal(expiresAt, Date.now());
    failedAttempts = 0;
    lapsed = false;
    wakeAt(plan.dueAt);
  }

  function wakeAt(time: number) {
    clearTimeout(timer);
    timer = setTimeout(
      renewIfDue,
      Math.min(Math.max(0, time - Date.now()), MAX_TIMER_MS),
    );
  }

  function renewIfDue() {
    if (stopped || renewing || !plan) return;
    if (Date.now() < plan.dueAt) wakeAt(plan.dueAt);
    else void renew(plan);
  }

  async function renew(current: Plan) {
    renewing = true;
    const attempt = await ports.withLock<Attempt>(() => {
      const shared = ports.sharedExpiry.read();
      return shared !== undefined && shared > current.expiresAt
        ? Promise.resolve({ kind: "shared", expiresAt: shared })
        : ports.refresh();
    });
    renewing = false;
    settle(attempt);
  }

  function settle(attempt: Attempt) {
    if (attempt.kind === "refreshed" && attempt.expiresAt) {
      ports.sharedExpiry.write(Date.parse(attempt.expiresAt));
    }
    if (stopped) return;

    switch (attempt.kind) {
      case "shared":
        adopt(attempt.expiresAt);
        return;
      case "refreshed":
        ports.report({ kind: "renewed", failedAttempts });
        if (attempt.expiresAt) adopt(Date.parse(attempt.expiresAt));
        return;
      case "expired":
        ports.report({ kind: "expired", failedAttempts });
        stop();
        return;
      case "failed":
        retryAfterFailure(attempt.retryAfterMs);
    }
  }

  // Past expiresAt the access cookie is gone, but a renewal still restores it,
  // so the next wake signal tries again instead of giving up.
  function retryAfterFailure(retryAfterMs: number | undefined) {
    if (!plan) return;
    failedAttempts += 1;
    const retryAt = Date.now() + cooldownAfter(failedAttempts, retryAfterMs);

    if (retryAt < plan.expiresAt) {
      plan = { ...plan, dueAt: retryAt };
      wakeAt(retryAt);
      return;
    }

    plan = { ...plan, dueAt: Date.now() };
    if (!lapsed) ports.report({ kind: "lapsed", failedAttempts });
    lapsed = true;
  }

  const unsubscribe = [
    ports.sharedExpiry.subscribe(adopt),
    ports.subscribeToWake(renewIfDue),
  ];

  function stop() {
    stopped = true;
    clearTimeout(timer);
    for (const release of unsubscribe) release();
  }

  adopt(Math.max(seed, ports.sharedExpiry.read() ?? 0));
  return stop;
}

// One schedule per document: a new start (StrictMode remount, a later seed)
// replaces the running one instead of stacking timers.
export function createSessionRenewal(ports: SessionRenewalPorts) {
  let stopActive = () => {};

  return {
    start(expiresAt: string): () => void {
      stopActive();
      const stop = runRenewal(ports, Date.parse(expiresAt));
      stopActive = stop;
      return stop;
    },
  };
}
