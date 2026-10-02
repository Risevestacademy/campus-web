const DELAY_SECONDS = /^\d+$/u;

export function parseRetryAfterMs(
  header: string | null,
  nowMs: number,
): number | undefined {
  const value = header?.trim();
  if (!value) return undefined;
  if (DELAY_SECONDS.test(value)) return Number(value) * 1000;

  const retryAtMs = Date.parse(value);
  return Number.isNaN(retryAtMs) ? undefined : Math.max(0, retryAtMs - nowMs);
}
