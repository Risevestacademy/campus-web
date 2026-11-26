"use client";

import type { ReactNode } from "react";

import { useTodayEvents } from "../hooks/use-calendar-events";
import { useCalendarModel } from "../hooks/use-calendar-model";
import { filterEvents, todayList } from "../services/calendar-time";
import { roomLinkAccess } from "../services/room-link-access";
import { CalendarFilters } from "./calendar-filters";
import { CalendarMiniMonth } from "./calendar-mini-month";
import { CalendarStatusLine } from "./calendar-status-line";
import { CalendarTodayList } from "./calendar-today-list";
import { ConnectCalendarLink } from "./connect-calendar-link";
import { DisconnectCalendarMenu } from "./disconnect-calendar-menu";
import { NewRoomLinkButton } from "./new-room-link-button";

// The Calendar panel in the sidebar: its status line, the gear that
// disconnects, and, once connected, the month, today's rooms and the filters.
// Not connected, it says what connecting gives.
export function CalendarPanel({
  administrator,
  cohortId,
  collapseButton,
  role,
}: Readonly<{
  administrator: boolean;
  cohortId: string;
  collapseButton: ReactNode;
  role?: "student" | "professor" | "mentor" | "guest";
}>) {
  const access = roomLinkAccess({ administrator, role });
  const model = useCalendarModel(cohortId);
  const { read, range, anchor, now, filters } = model;
  const today = todayList(
    filterEvents(useTodayEvents(cohortId, range, model.events, now), filters),
    now,
  );
  const kind = !read
    ? "pending"
    : read.kind === "connected" || (read.kind === "unavailable" && model.held)
      ? "connected"
      : read.kind === "not-connected"
        ? "not-connected"
        : "other";

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-foreground text-xl font-semibold">Calendar</h2>
          <p className="text-foreground-secondary text-xs" role="status">
            <CalendarStatusLine kind={kind} loadedAt={model.loadedAt} />
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {kind === "connected" ? <DisconnectCalendarMenu /> : null}
          {collapseButton}
        </div>
      </div>

      {kind === "not-connected" ? (
        <div className="bg-surface-hover grid gap-3 rounded-xl p-4 text-sm">
          <p>Classes and meetings show up here once you connect.</p>
          <ConnectCalendarLink className="w-full" />
        </div>
      ) : null}

      {kind === "connected" ? (
        <>
          {access === "none" ? null : (
            <NewRoomLinkButton access={access} cohortId={cohortId} />
          )}
          <CalendarMiniMonth anchor={anchor} visible={range} now={now} />
          <CalendarTodayList events={today} now={now} />
          <CalendarFilters filters={filters} />
        </>
      ) : null}
    </div>
  );
}
