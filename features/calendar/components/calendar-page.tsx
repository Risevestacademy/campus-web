"use client";

import { Button } from "@/shared/ui/button";

import { useCalendarModel } from "../hooks/use-calendar-model";
import { rangeTitle } from "../services/calendar-labels";
import { daysOf } from "../services/calendar-window";
import {
  openCalendarDay,
  setCalendarView,
  showToday,
  stepCalendar,
} from "../store/calendar-view-store";
import { CalendarConnectCard } from "./calendar-connect-card";
import { CalendarToolbar } from "./calendar-toolbar";
import { MonthGrid } from "./month-grid";
import { TimeGrid } from "./time-grid";

const EMPTY = {
  day: "No events today.",
  week: "No events this week.",
  month: "No events this month.",
} as const;

// The calendar's main area. Until Google answers it says so; not connected, it
// offers to connect; connected, it shows the days.
export function CalendarPage({ cohortId }: Readonly<{ cohortId: string }>) {
  const model = useCalendarModel(cohortId);
  const { read, view, anchor, range, now } = model;

  if (!read) {
    return (
      <div className="grid min-h-full place-items-center p-6">
        <p className="text-foreground-secondary" role="status">
          Checking Google Calendar…
        </p>
      </div>
    );
  }

  if (read.kind === "not-connected") {
    return (
      <div className="grid min-h-full place-items-center gap-4 p-6">
        {model.ended ? (
          <p role="status" className="text-foreground-secondary text-center">
            Google ended the connection. Connect again to see your events.
          </p>
        ) : null}
        <CalendarConnectCard />
      </div>
    );
  }

  if (
    read.kind === "signed-out" ||
    (read.kind === "unavailable" && !model.held)
  ) {
    return (
      <div className="grid min-h-full place-items-center p-6">
        <div
          role="alert"
          className="grid max-w-sm justify-items-center gap-3 text-center"
        >
          <h2 className="font-display text-2xl font-bold">
            {read.kind === "signed-out"
              ? "Your session ran out"
              : "Google Calendar didn’t answer."}
          </h2>
          <p className="text-foreground-secondary text-pretty">
            {read.kind === "signed-out"
              ? "Sign in and try again."
              : "Try again in a moment."}
          </p>
          {read.kind === "signed-out" ? null : (
            <Button variant="outline" onClick={model.refetch}>
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  const days = daysOf(range);
  const truncated = read.kind === "connected" && read.truncated;
  const notice = model.dimmed
    ? "Google Calendar didn’t answer."
    : truncated
      ? "Showing the first 1,000 events. Choose a shorter range."
      : model.shown.length === 0 && !model.loading
        ? EMPTY[view]
        : null;

  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy={model.loading}>
      <CalendarToolbar
        title={rangeTitle(view, anchor, range)}
        view={view}
        onToday={showToday}
        onStep={(direction) => stepCalendar(direction, now)}
        onView={setCalendarView}
      />
      <div role="status" className="shrink-0 empty:hidden">
        {notice ? (
          <p className="border-shell-line text-foreground-secondary flex items-center gap-3 border-b px-4 py-2 text-sm">
            {notice}
            {model.dimmed ? (
              <Button variant="outline" size="xs" onClick={model.refetch}>
                Retry
              </Button>
            ) : null}
          </p>
        ) : null}
      </div>
      <div
        className={
          model.dimmed || model.loading
            ? "flex min-h-0 flex-1 flex-col opacity-60"
            : "flex min-h-0 flex-1 flex-col"
        }
      >
        {view === "month" ? (
          <MonthGrid
            days={days}
            anchor={anchor}
            events={model.shown}
            now={now}
            onOpenDay={openCalendarDay}
          />
        ) : (
          <TimeGrid key={view} days={days} events={model.shown} now={now} />
        )}
      </div>
    </div>
  );
}
