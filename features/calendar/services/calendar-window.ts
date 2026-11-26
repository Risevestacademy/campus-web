export type CalendarView = "day" | "week" | "month";

export type CalendarWindow = Readonly<{ from: string; to: string }>;

// The days the grid shows, from the first midnight to the one after the last.
export type CalendarRange = Readonly<{ start: Date; end: Date }>;

const MAX_WINDOW_DAYS = 62;
export const MONTH_GRID_DAYS = 42;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Calendar days, never 24-hour steps, so a day with a clock change still
// starts at its own midnight.
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function rangeOf(view: CalendarView, anchor: Date): CalendarRange {
  const day = startOfDay(anchor);
  if (view === "day") return { start: day, end: addDays(day, 1) };
  if (view === "week") {
    const start = startOfWeek(day);
    return { start, end: addDays(start, 7) };
  }
  const start = startOfWeek(new Date(day.getFullYear(), day.getMonth(), 1));
  return { start, end: addDays(start, MONTH_GRID_DAYS) };
}

export function daysOf({ start, end }: CalendarRange): Date[] {
  const days: Date[] = [];
  for (let day = start; day < end; day = addDays(day, 1)) days.push(day);
  return days;
}

// A month steps to the same day of the next month, or its last day when that
// month is shorter.
export function stepAnchor(
  view: CalendarView,
  anchor: Date,
  direction: 1 | -1,
): Date {
  const day = startOfDay(anchor);
  if (view === "day") return addDays(day, direction);
  if (view === "week") return addDays(day, 7 * direction);
  const target = new Date(day.getFullYear(), day.getMonth() + direction, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0);
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    Math.min(day.getDate(), last.getDate()),
  );
}

// What is asked of campus-api for a range: never more than the 62 days it
// reads.
export function windowOf({ start, end }: CalendarRange): CalendarWindow {
  const limit = addDays(start, MAX_WINDOW_DAYS);
  return {
    from: start.toISOString(),
    to: (end > limit ? limit : end).toISOString(),
  };
}
