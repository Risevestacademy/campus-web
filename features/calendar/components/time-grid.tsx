"use client";

import { cn } from "cn";
import { useCallback, useMemo } from "react";

import type { CalendarEvent } from "../schemas/calendar-events.schema";
import { formatWeekday, hourLabel } from "../services/calendar-labels";
import {
  allDayPlacement,
  boundsOf,
  layoutOverlaps,
  segmentsOf,
} from "../services/calendar-time";
import { isSameDay } from "../services/calendar-window";
import { CalendarEventBlock } from "./calendar-event-block";

const HOUR_PX = 56;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function percent(minute: number): string {
  return `${(minute / (24 * 60)) * 100}%`;
}

// The hours of the day down the side and a column for each day: Week with
// seven, Day with one. All-day events sit in a strip above the hours.
export function TimeGrid({
  days,
  events,
  now,
}: Readonly<{
  days: readonly Date[];
  events: readonly CalendarEvent[];
  now: Date;
}>) {
  const columns = `3.5rem repeat(${days.length}, minmax(0, 1fr))`;

  const { allDay, byDay, firstMinute } = useMemo(() => {
    const allDay: {
      event: CalendarEvent;
      startIndex: number;
      endIndex: number;
    }[] = [];
    const timed: Record<
      number,
      { event: CalendarEvent; startMinute: number; endMinute: number }[]
    > = {};
    let firstMinute: number | undefined;

    for (const event of events) {
      const bounds = boundsOf(event);
      if (event.allDay) {
        const placement = allDayPlacement(bounds, days);
        if (placement) allDay.push({ event, ...placement });
        continue;
      }
      for (const segment of segmentsOf(bounds, days)) {
        (timed[segment.dayIndex] ??= []).push({ event, ...segment });
        firstMinute = Math.min(firstMinute ?? Infinity, segment.startMinute);
      }
    }
    const byDay = days.map((_, index) => layoutOverlaps(timed[index] ?? []));
    return { allDay, byDay, firstMinute };
  }, [events, days]);

  // Open an hour before now if today is shown, or before the first event, or
  // at the start of the working day.
  const scrollTo = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return;
      const today = days.some((day) => isSameDay(day, now));
      const minute = today ? now.getHours() * 60 : (firstMinute ?? 8 * 60);
      element.scrollTop = Math.max(0, (minute / 60 - 1) * HOUR_PX);
    },
    // Only when the grid opens: moving the clock must not move the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="border-shell-line grid shrink-0 border-b pr-[var(--scrollbar-gap,0px)]"
        style={{ gridTemplateColumns: columns }}
      >
        <div />
        {days.map((day) => {
          const today = isSameDay(day, now);
          return (
            <div
              key={day.getTime()}
              className="grid justify-items-center gap-0.5 py-2"
            >
              <span className="text-foreground-secondary text-xs">
                {formatWeekday(day)}
              </span>
              <span
                aria-current={today ? "date" : undefined}
                className={cn(
                  "grid size-7 place-items-center rounded-full text-sm font-semibold",
                  today && "bg-primary text-primary-foreground",
                )}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {allDay.length > 0 ? (
        <ul
          aria-label="All-day events"
          className="border-shell-line grid shrink-0 gap-0.5 border-b py-1"
          style={{ gridTemplateColumns: columns }}
        >
          {allDay.map(({ event, startIndex, endIndex }) => (
            <li
              key={event.id}
              className="min-w-0"
              style={{
                gridColumn: `${startIndex + 2} / ${endIndex + 3}`,
              }}
            >
              <CalendarEventBlock event={event} now={now} compact />
            </li>
          ))}
        </ul>
      ) : null}

      <div ref={scrollTo} className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: columns,
            height: `${HOURS.length * HOUR_PX}px`,
          }}
        >
          <div aria-hidden className="relative">
            {HOURS.slice(1).map((hour) => (
              <span
                key={hour}
                className="text-foreground-secondary absolute right-2 -translate-y-1/2 text-[11px]"
                style={{ top: percent(hour * 60) }}
              >
                {hourLabel(hour)}
              </span>
            ))}
          </div>
          {days.map((day, index) => (
            <div
              key={day.getTime()}
              className="border-shell-line relative border-l"
            >
              {HOURS.slice(1).map((hour) => (
                <div
                  key={hour}
                  aria-hidden
                  className="border-shell-line absolute inset-x-0 border-t"
                  style={{ top: percent(hour * 60) }}
                />
              ))}
              <ul
                aria-label={`Events on ${formatWeekday(day)} ${day.getDate()}`}
              >
                {byDay[index]?.map(
                  ({ event, startMinute, endMinute, lane, lanes }) => (
                    <li key={`${event.id}-${startMinute}`}>
                      <CalendarEventBlock
                        event={event}
                        now={now}
                        className="absolute"
                        style={{
                          top: percent(startMinute),
                          height: percent(endMinute - startMinute),
                          left: `calc(${(lane / lanes) * 100}% + 1px)`,
                          width: `calc(${100 / lanes}% - 3px)`,
                        }}
                      />
                    </li>
                  ),
                )}
              </ul>
              {isSameDay(day, now) ? (
                <div
                  aria-hidden
                  data-testid="now-line"
                  className="bg-error-500 pointer-events-none absolute inset-x-0 z-10 h-0.5"
                  style={{
                    top: percent(now.getHours() * 60 + now.getMinutes()),
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
