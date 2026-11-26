import type { ApiClient } from "@/core/api/client";

import { parseCalendarStatus } from "../schemas/calendar-status.schema";
import type { CalendarWindow } from "./calendar-window";

export type CalendarStatusRead =
  | { kind: "connected" }
  // No grant, or Google withdrew it: campus-api answers 200 with
  // `connected: false` for both.
  | { kind: "not-connected" }
  | { kind: "signed-out" }
  | { kind: "unavailable" };

export async function readCalendarStatus(
  api: ApiClient,
  { from, to }: CalendarWindow,
  signal?: AbortSignal,
): Promise<CalendarStatusRead> {
  try {
    const { data, response } = await api.GET("/v1/calendar/events", {
      params: { query: { from, to } },
      signal,
    });
    if (response.status === 401) return { kind: "signed-out" };

    const status = response.ok ? parseCalendarStatus(data) : undefined;
    if (!status) return { kind: "unavailable" };
    return { kind: status.connected ? "connected" : "not-connected" };
  } catch {
    return { kind: "unavailable" };
  }
}

export type CalendarDisconnect = "disconnected" | "signed-out" | "failed";

export async function disconnectCalendar(
  api: ApiClient,
): Promise<CalendarDisconnect> {
  try {
    const { response } = await api.DELETE("/v1/calendar");
    if (response.status === 401) return "signed-out";
    return response.ok ? "disconnected" : "failed";
  } catch {
    return "failed";
  }
}
