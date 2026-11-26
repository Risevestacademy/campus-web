import { useQuery } from "@tanstack/react-query";

import { browserApi } from "@/core/api/client/browser";

import { readCalendarStatus } from "../services/calendar-api.adapter";
import { weekWindowOf } from "../services/calendar-window";

export const CALENDAR_STATUS_KEY = ["calendar", "status"] as const;

const ONE_MINUTE = 60_000;

// Whether the member's calendar is connected, read from the events route for
// this week. Google is asked each time, so a read is kept for a minute and a
// failed one is not kept, so the next look asks again.
export function useCalendarStatus() {
  return useQuery({
    queryKey: CALENDAR_STATUS_KEY,
    queryFn: ({ signal }) =>
      readCalendarStatus(browserApi, weekWindowOf(new Date()), signal),
    staleTime: (current) =>
      current.state.data?.kind === "unavailable" ? 0 : ONE_MINUTE,
    retry: false,
  });
}
