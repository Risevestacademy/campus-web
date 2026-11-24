"use client";

import { formatLoadedTime } from "../services/loaded-time";

// "Connected to Google · loaded 14:20". Campus-api reads Google when asked and
// keeps no sync time, so the time is when this device last loaded the events.
export function CalendarStatusLine({
  kind,
  loadedAt,
}: Readonly<{
  kind: "pending" | "connected" | "not-connected" | "other";
  loadedAt: number;
}>) {
  if (kind === "pending") return <span>Checking Google…</span>;
  if (kind === "connected") {
    return (
      <span>Connected to Google · loaded {formatLoadedTime(loadedAt)}</span>
    );
  }
  if (kind === "not-connected") return <span>Not connected to Google</span>;
  return <span>Couldn&rsquo;t reach Google</span>;
}
