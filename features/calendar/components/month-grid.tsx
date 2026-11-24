"use client";

import { cn } from "cn";
import { useMemo } from "react";

import type { CalendarEvent } from "../schemas/calendar-events.schema";
import { formatDayLong, formatWeekday } from "../services/calendar-labels";
import { monthCells } from "../services/calendar-time";
import { CalendarEventBlock } from "./calendar-event-block";

// Six weeks, each day with up to three events and a "+n more" that opens the
// day.
export function MonthGrid({
  days,
  anchor,
  events,
  now,
  onOpenDay,
}: Readonly<{
  days: readonly Date[];
  anchor: Date;
  events: readonly CalendarEvent[];
  now: Date;
  onOpenDay: (day: Date) => void;
}>) {
  const cells = useMemo(
    () => monthCells(events, days, anchor, now),
    [events, days, anchor, now],
  );
  const firstWeek = days.slice(0, 7);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-shell-line grid shrink-0 grid-cols-7 border-b">
        {firstWeek.map((day) => (
          <span
            key={day.getTime()}
            className="text-foreground-secondary py-2 text-center text-xs"
          >
            {formatWeekday(day)}
          </span>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 overflow-y-auto">
        {cells.map(({ day, inMonth, isToday, shown, more }) => (
          <div
            key={day.getTime()}
            className={cn(
              "border-shell-line grid min-h-24 min-w-0 content-start gap-0.5 border-r border-b p-1",
              !inMonth && "bg-surface-hover/50",
            )}
          >
            <span
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "grid size-6 place-items-center justify-self-start rounded-full text-xs font-semibold",
                isToday && "bg-primary text-primary-foreground",
                !inMonth && !isToday && "text-foreground-secondary",
              )}
            >
              {day.getDate()}
            </span>
            {shown.map((event) => (
              <CalendarEventBlock
                key={`${event.id}-${day.getTime()}`}
                event={event}
                now={now}
                compact
              />
            ))}
            {more > 0 ? (
              <button
                type="button"
                onClick={() => onOpenDay(day)}
                aria-label={`${more} more events on ${formatDayLong(day)}`}
                className="text-foreground-secondary hover:text-foreground focus-visible:ring-ring cursor-pointer rounded px-1 text-left text-xs outline-none focus-visible:ring-2"
              >
                +{more} more
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
