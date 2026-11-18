const MINUTE_MS = 60_000;

// To the nearest minute, as a clock that ticks a few seconds late still
// reads true, and never below one while the timer runs.
export function statusTimeLeft(
  statusUntil: string | null,
  nowMs: number,
): string | null {
  if (statusUntil === null) return null;
  const leftMs = Date.parse(statusUntil) - nowMs;
  if (!(leftMs > 0)) return null;

  const minutes = Math.max(1, Math.round(leftMs / MINUTE_MS));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
