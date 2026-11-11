import type { WorldSocial } from "@/core/realtime";

export const MAX_ACTIVE_INTERVAL_MS = 60_000;

const ACTIVITY_EVENTS = [
  "keydown",
  "pointerdown",
  "pointermove",
  "wheel",
] as const;

export function activeIntervalMs(awayAfterSeconds: number): number {
  return Math.min(MAX_ACTIVE_INTERVAL_MS, (awayAfterSeconds * 1000) / 4);
}

export interface ActivityPorts {
  now: () => number;
  subscribeToActivity: (listener: () => void) => () => void;
}

export function reportActivity(
  social: Pick<WorldSocial, "readAwayAfterSeconds" | "sendActive">,
  { now, subscribeToActivity }: ActivityPorts,
): () => void {
  let lastSentAt = Number.NEGATIVE_INFINITY;

  return subscribeToActivity(() => {
    const awayAfterSeconds = social.readAwayAfterSeconds();
    if (!awayAfterSeconds) return;
    const at = now();
    if (at - lastSentAt < activeIntervalMs(awayAfterSeconds)) return;
    if (social.sendActive()) lastSentAt = at;
  });
}

export function subscribeToBrowserActivity(listener: () => void): () => void {
  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, listener, { capture: true, passive: true });
  }

  return () => {
    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, listener, { capture: true });
    }
  };
}
