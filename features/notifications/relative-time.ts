const UNITS = [
  { unit: "day", ms: 86_400_000 },
  { unit: "hour", ms: 3_600_000 },
  { unit: "minute", ms: 60_000 },
] as const satisfies readonly {
  unit: Intl.RelativeTimeFormatUnit;
  ms: number;
}[];

const FORMAT = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

// "3 minutes ago", "yesterday". Under a minute, and a time ahead of the clock
// (a skewed one), read as "just now" rather than a number nobody trusts.
export function relativeTime(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";

  const elapsed = now - then;
  for (const { unit, ms } of UNITS) {
    if (elapsed >= ms) return FORMAT.format(-Math.floor(elapsed / ms), unit);
  }
  return "just now";
}
