import {
  STATUS_DURATION_MAX_SECONDS,
  STATUS_DURATION_MIN_SECONDS,
} from "@/core/realtime";

export const STATUS_DURATIONS = [
  { id: "30m", label: "30 min" },
  { id: "1h", label: "1 h" },
  { id: "2h", label: "2 h" },
  { id: "4h", label: "4 h" },
  { id: "today", label: "Today" },
] as const;

export type StatusDurationId = (typeof STATUS_DURATIONS)[number]["id"];

const FIXED_SECONDS = {
  "30m": 30 * 60,
  "1h": 60 * 60,
  "2h": 2 * 60 * 60,
  "4h": 4 * 60 * 60,
} as const;

function secondsUntilMidnight(now: Date): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

export function durationSecondsOf(id: StatusDurationId, now: Date): number {
  if (id === "today") return secondsUntilMidnight(now);
  return FIXED_SECONDS[id];
}

export function durationRefusalOf(seconds: number | undefined): string | null {
  if (seconds === undefined) return null;
  if (seconds < STATUS_DURATION_MIN_SECONDS) {
    return "Less than a minute of today is left.";
  }
  if (seconds > STATUS_DURATION_MAX_SECONDS) {
    return "A status lasts 12 hours at most, and today has longer left.";
  }
  return null;
}
