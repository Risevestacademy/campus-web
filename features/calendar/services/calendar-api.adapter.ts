import type { ApiClient } from "@/core/api/client";

import {
  type CalendarEvent,
  parseCalendarEvents,
} from "../schemas/calendar-events.schema";
import type { CalendarWindow } from "./calendar-window";

export type CalendarRead =
  | {
      kind: "connected";
      events: readonly CalendarEvent[];
      truncated: boolean;
    }
  // No grant, or Google withdrew it: campus-api answers 200 with
  // `connected: false` for both. `by: "member"` is set when the member
  // disconnected here, so it is not mistaken for Google ending the connection.
  | { kind: "not-connected"; by?: "member" }
  | { kind: "signed-out" }
  | { kind: "unavailable" };

// The member's events for a window, as this cohort may show them: an event
// with no room of the cohort's keeps only its times.
export async function readCalendarEvents(
  api: ApiClient,
  { from, to }: CalendarWindow,
  cohortId: string,
  signal?: AbortSignal,
): Promise<CalendarRead> {
  try {
    const { data, response } = await api.GET("/v1/calendar/events", {
      params: { query: { from, to } },
      signal,
    });
    if (response.status === 401) return { kind: "signed-out" };

    const read = response.ok ? parseCalendarEvents(data, cohortId) : undefined;
    if (!read) return { kind: "unavailable" };
    return read.connected
      ? { kind: "connected", events: read.events, truncated: read.truncated }
      : { kind: "not-connected" };
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
