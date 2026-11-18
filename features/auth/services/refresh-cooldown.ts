const COOLDOWN_SCHEDULE_MS = [1000, 2000, 4000, 8000] as const;
const MAX_COOLDOWN_MS = 8000;

// Backoff after the nth failed refresh in a row, stretched by Retry-After but
// never past the longest cooldown.
export function cooldownAfter(failures: number, retryAfterMs = 0): number {
  const scheduledMs = COOLDOWN_SCHEDULE_MS[
    Math.min(failures, COOLDOWN_SCHEDULE_MS.length) - 1
  ] as number;
  return Math.max(scheduledMs, Math.min(retryAfterMs, MAX_COOLDOWN_MS));
}
