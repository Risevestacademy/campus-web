export const STATUS_DURATIONS = [
  { id: "30m", label: "30 min", seconds: 30 * 60 },
  { id: "1h", label: "1 h", seconds: 60 * 60 },
  { id: "2h", label: "2 h", seconds: 2 * 60 * 60 },
  { id: "4h", label: "4 h", seconds: 4 * 60 * 60 },
] as const;

export type StatusDurationId = (typeof STATUS_DURATIONS)[number]["id"];

export function durationSecondsOf(id: StatusDurationId): number {
  return STATUS_DURATIONS.find((duration) => duration.id === id)!.seconds;
}
