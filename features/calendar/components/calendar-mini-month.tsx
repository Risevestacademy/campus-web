"use client";

import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { cn } from "cn";

import { Button } from "@/shared/ui/button";

import {
  formatDayLong,
  formatMonthYear,
  formatWeekday,
} from "../services/calendar-labels";
import {
  type CalendarRange,
  daysOf,
  isSameDay,
  rangeOf,
  stepAnchor,
} from "../services/calendar-window";
import { showCalendarDay } from "../store/calendar-view-store";

// A small month beside the grid. Pressing a day moves the grid to it, and the
// arrows move a month; the days the grid shows are tinted.
export function CalendarMiniMonth({
  anchor,
  visible,
  now,
}: Readonly<{ anchor: Date; visible: CalendarRange; now: Date }>) {
  const days = daysOf(rangeOf("month", anchor));

  return (
    <section aria-label="Month" className="grid gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{formatMonthYear(anchor)}</h3>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Previous month"
            onClick={() => showCalendarDay(stepAnchor("month", anchor, -1))}
          >
            <CaretLeftIcon aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Next month"
            onClick={() => showCalendarDay(stepAnchor("month", anchor, 1))}
          >
            <CaretRightIcon aria-hidden />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-xs">
        {days.slice(0, 7).map((day) => (
          <span
            key={day.getTime()}
            aria-hidden
            className="text-foreground-secondary py-1"
          >
            {formatWeekday(day).slice(0, 2)}
          </span>
        ))}
        {days.map((day) => {
          const today = isSameDay(day, now);
          const shown = day >= visible.start && day < visible.end;
          return (
            <button
              key={day.getTime()}
              type="button"
              aria-label={`${formatDayLong(day)} ${day.getFullYear()}`}
              aria-current={today ? "date" : undefined}
              aria-pressed={isSameDay(day, anchor)}
              onClick={() => showCalendarDay(day)}
              className={cn(
                "focus-visible:ring-ring grid h-8 cursor-pointer place-items-center text-xs outline-none focus-visible:ring-2",
                shown && "bg-surface-hover",
                day.getMonth() !== anchor.getMonth() &&
                  "text-foreground-secondary",
                today && "text-primary font-bold",
                isSameDay(day, anchor) &&
                  "bg-primary text-primary-foreground rounded-full",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </section>
  );
}
