import type { WorldSocial } from "@/core/realtime";

export const ACTIVE_REPORT_INTERVAL_MS = 60_000;

const ACTIVITY_EVENTS = ["keydown", "pointerdown", "pointermove"] as const;

export interface ActivityPorts {
  now: () => number;
  subscribeToActivity: (listener: () => void) => () => void;
}

export function reportActivity(
  social: Pick<WorldSocial, "sendActive">,
  { now, subscribeToActivity }: ActivityPorts,
): () => void {
  let lastSentAt = Number.NEGATIVE_INFINITY;

  return subscribeToActivity(() => {
    const at = now();
    if (at - lastSentAt < ACTIVE_REPORT_INTERVAL_MS) return;
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
