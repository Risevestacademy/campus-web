import type { CalendarEvent } from "../schemas/calendar-events.schema";
import { addDays, isSameDay, startOfDay } from "./calendar-window";

const MINUTE = 60_000;
const LIVE_LEAD = 10 * MINUTE;
const DAY_MINUTES = 24 * 60;
// A one-line event is easier to press than a sliver.
const MIN_MINUTES = 20;

export type EventBounds = Readonly<{ start: Date; end: Date }>;

function plainDate(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// An all-day event's dates are days, not moments: reading them as timestamps
// would move them a day in some zones. Its end is the day after the last one.
export function boundsOf(event: CalendarEvent): EventBounds {
  return event.allDay
    ? { start: plainDate(event.start), end: plainDate(event.end) }
    : { start: new Date(event.start), end: new Date(event.end) };
}

function overlapsDay(bounds: EventBounds, day: Date): boolean {
  const next = addDays(day, 1);
  const end = Math.max(bounds.end.getTime(), bounds.start.getTime() + 1);
  return bounds.start < next && end > day.getTime();
}

// Whether an event touches a day, whichever way it is drawn.
export function eventOnDay(event: CalendarEvent, day: Date): boolean {
  return overlapsDay(boundsOf(event), startOfDay(day));
}

export type DaySegment = Readonly<{
  dayIndex: number;
  // Minutes on the wall clock of that day, so the grid's hours stay put on a
  // day the clocks change.
  startMinute: number;
  endMinute: number;
}>;

function wallMinute(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

// A timed event cut at midnight into the part that falls on each day shown.
export function segmentsOf(
  bounds: EventBounds,
  days: readonly Date[],
): DaySegment[] {
  const segments: DaySegment[] = [];
  days.forEach((day, dayIndex) => {
    if (!overlapsDay(bounds, day)) return;
    const next = addDays(day, 1);
    const start = bounds.start > day ? bounds.start : day;
    const end = bounds.end < next ? bounds.end : next;
    const startMinute = wallMinute(start);
    const endMinute =
      end.getTime() === next.getTime() ? DAY_MINUTES : wallMinute(end);
    segments.push({
      dayIndex,
      startMinute,
      endMinute: Math.max(endMinute, startMinute + MIN_MINUTES),
    });
  });
  return segments;
}

export type AllDayPlacement = Readonly<{
  startIndex: number;
  endIndex: number;
}>;

// The columns an all-day event covers, first to last.
export function allDayPlacement(
  bounds: EventBounds,
  days: readonly Date[],
): AllDayPlacement | undefined {
  let startIndex = -1;
  let endIndex = -1;
  days.forEach((day, index) => {
    if (day >= bounds.start && day < bounds.end) {
      if (startIndex < 0) startIndex = index;
      endIndex = index;
    }
  });
  return startIndex < 0 ? undefined : { startIndex, endIndex };
}

export type Laned<T> = T & Readonly<{ lane: number; lanes: number }>;

// Events that overlap share the column's width side by side: each takes the
// first lane free when it starts, and every event of a run of overlaps is as
// wide as that run is deep.
export function layoutOverlaps<
  T extends { startMinute: number; endMinute: number },
>(items: readonly T[]): Laned<T>[] {
  const sorted = [...items].sort(
    (a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute,
  );
  const result: Laned<T>[] = [];
  let cluster: { item: T; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = 0;

  const close = () => {
    for (const { item, lane } of cluster) {
      result.push({ ...item, lane, lanes: laneEnds.length });
    }
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (cluster.length > 0 && item.startMinute >= clusterEnd) close();
    let lane = laneEnds.findIndex((end) => end <= item.startMinute);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = item.endMinute;
    clusterEnd = Math.max(clusterEnd, item.endMinute);
    cluster.push({ item, lane });
  }
  close();
  return result;
}

// An event with a room is live from ten minutes before it starts until it
// ends; that is when campus lets a member in.
export function isLive(event: CalendarEvent, now: Date): boolean {
  if (event.kind !== "campus") return false;
  const { start, end } = boundsOf(event);
  return now.getTime() >= start.getTime() - LIVE_LEAD && now < end;
}

export function sortEvents(events: readonly CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(
    (a, b) =>
      Number(b.allDay) - Number(a.allDay) ||
      boundsOf(a).start.getTime() - boundsOf(b).start.getTime(),
  );
}

// The kinds of event the member has switched on.
export function filterEvents(
  events: readonly CalendarEvent[],
  filters: Readonly<{ campus: boolean; busy: boolean }>,
): CalendarEvent[] {
  return events.filter((event) =>
    event.kind === "campus" ? filters.campus : filters.busy,
  );
}

// The Today list: today's events that carry a room, soonest first.
export function todayList(
  events: readonly CalendarEvent[],
  now: Date,
): CalendarEvent[] {
  const today = startOfDay(now);
  return sortEvents(
    events.filter(
      (event) => event.kind === "campus" && eventOnDay(event, today),
    ),
  );
}

export type MonthCell = Readonly<{
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  shown: readonly CalendarEvent[];
  more: number;
}>;

export const MONTH_CELL_LIMIT = 3;

export function monthCells(
  events: readonly CalendarEvent[],
  days: readonly Date[],
  anchor: Date,
  now: Date,
): MonthCell[] {
  return days.map((day) => {
    const onDay = sortEvents(events.filter((event) => eventOnDay(event, day)));
    return {
      day,
      inMonth: day.getMonth() === anchor.getMonth(),
      isToday: isSameDay(day, now),
      shown: onDay.slice(0, MONTH_CELL_LIMIT),
      more: Math.max(0, onDay.length - MONTH_CELL_LIMIT),
    };
  });
}
