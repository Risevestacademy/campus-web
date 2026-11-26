import type { CalendarEvent } from "../schemas/calendar-events.schema";
import { boundsOf } from "./calendar-time";
import {
  addDays,
  type CalendarRange,
  type CalendarView,
} from "./calendar-window";

const time = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const weekdayDay = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const dayMonth = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});
const dayMonthYear = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const monthYear = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});
const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });

export const formatClock = (date: Date) => time.format(date);
export const formatWeekday = (date: Date) => weekday.format(date);
export const formatMonthYear = (date: Date) => monthYear.format(date);
export const formatDayLong = (date: Date) => weekdayDay.format(date);

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

// The title above the grid: the one day, the week's first and last days, or
// the month.
export function rangeTitle(
  view: CalendarView,
  anchor: Date,
  range: CalendarRange,
): string {
  if (view === "month") return monthYear.format(anchor);
  if (view === "day") return dayMonthYear.format(anchor);
  const last = addDays(range.end, -1);
  return `${dayMonth.format(range.start)} – ${dayMonthYear.format(last)}`;
}

// "10:00 – 10:30", or "All day".
export function eventTimeLabel(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  const { start, end } = boundsOf(event);
  return `${formatClock(start)} – ${formatClock(end)}`;
}

// What a screen reader hears for an event: its title, the day and the time.
export function eventAccessibleName(event: CalendarEvent): string {
  const title =
    event.kind === "busy" ? "Busy" : (event.title ?? "Untitled event");
  const { start } = boundsOf(event);
  return `${title}, ${weekdayDay.format(start)}, ${eventTimeLabel(event)}`;
}

export function eventTitle(event: CalendarEvent): string {
  return event.kind === "busy" ? "Busy" : (event.title ?? "Untitled event");
}
