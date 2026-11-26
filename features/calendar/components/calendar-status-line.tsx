"use client";

import { useCalendarStatus } from "../hooks/use-calendar-status";
import { formatLoadedTime } from "../services/loaded-time";

// "Connected to Google · loaded 14:20". Campus-api reads Google when asked and
// keeps no sync time, so the time is when this device last loaded the events.
export function CalendarStatusLine() {
  const { data, dataUpdatedAt, isPending } = useCalendarStatus();

  if (isPending) return <span>Checking Google…</span>;
  if (data?.kind === "connected") {
    return (
      <span>
        Connected to Google · loaded {formatLoadedTime(dataUpdatedAt)}
      </span>
    );
  }
  if (data?.kind === "not-connected")
    return <span>Not connected to Google</span>;
  return <span>Couldn&rsquo;t reach Google</span>;
}
