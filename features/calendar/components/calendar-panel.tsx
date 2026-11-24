"use client";

import type { ReactNode } from "react";

import { useCalendarStatus } from "../hooks/use-calendar-status";
import { CalendarStatusLine } from "./calendar-status-line";
import { ConnectCalendarLink } from "./connect-calendar-link";
import { DisconnectCalendarMenu } from "./disconnect-calendar-menu";

// The Calendar panel in the sidebar: its status line and, once connected, the
// gear that disconnects. Not connected, it says what connecting gives.
export function CalendarPanel({
  collapseButton,
}: Readonly<{ cohortId?: string; collapseButton: ReactNode }>) {
  const { data } = useCalendarStatus();

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-foreground text-xl font-semibold">Calendar</h2>
          <p className="text-foreground-secondary text-xs" role="status">
            <CalendarStatusLine />
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {data?.kind === "connected" ? <DisconnectCalendarMenu /> : null}
          {collapseButton}
        </div>
      </div>

      {data?.kind === "not-connected" ? (
        <div className="bg-surface-hover grid gap-3 rounded-xl p-4 text-sm">
          <p>Classes and meetings show up here once you connect.</p>
          <ConnectCalendarLink className="w-full" />
        </div>
      ) : null}
    </div>
  );
}
