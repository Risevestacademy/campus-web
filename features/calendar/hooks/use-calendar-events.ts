import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { browserApi } from "@/core/api/client/browser";

import type { CalendarEvent } from "../schemas/calendar-events.schema";
import {
  type CalendarRead,
  readCalendarEvents,
} from "../services/calendar-api.adapter";
import {
  type CalendarRange,
  rangeOf,
  startOfDay,
  windowOf,
} from "../services/calendar-window";
import { anchorOf, useCalendarView } from "../store/calendar-view-store";
import { useNow } from "./use-now";

export const CALENDAR_EVENTS_KEY = ["calendar", "events"] as const;

const ONE_MINUTE = 60_000;

type ConnectedRead = Extract<CalendarRead, { kind: "connected" }>;

// One read of the events for a range. Google is asked each time, so a read is
// kept for a minute and a failed one is not kept, so the next look asks again.
// The days before stay on screen while the next ones load.
function useCalendarRead(
  cohortId: string,
  range: CalendarRange,
  enabled: boolean,
) {
  const window = windowOf(range);

  return useQuery({
    queryKey: [...CALENDAR_EVENTS_KEY, cohortId, window.from, window.to],
    queryFn: ({ signal }) =>
      readCalendarEvents(browserApi, window, cohortId, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: (current) =>
      current.state.data?.kind === "unavailable" ? 0 : ONE_MINUTE,
    retry: false,
  });
}

export type CalendarEventsState = Readonly<{
  // Null until the first answer.
  read: CalendarRead | undefined;
  // The last events that did arrive, so a Google that stops answering dims
  // them rather than emptying the page.
  held: ConnectedRead | undefined;
  // The member had a calendar here and now has none, and did not ask for it.
  ended: boolean;
  loading: boolean;
  loadedAt: number;
  refetch: () => void;
}>;

// The events of the range the member is looking at.
export function useCalendarEvents(
  cohortId: string,
  range: CalendarRange,
): CalendarEventsState {
  const query = useCalendarRead(cohortId, range, true);
  return useHeldRead(query);
}

function useHeldRead(
  query: ReturnType<typeof useCalendarRead>,
): CalendarEventsState {
  const read = query.data;
  const [held, setHeld] = useState<ConnectedRead>();
  const [wasConnected, setWasConnected] = useState(false);

  if (read?.kind === "connected" && held !== read) {
    setHeld(read);
    setWasConnected(true);
  }
  if (read?.kind === "not-connected" && read.by === "member" && wasConnected) {
    setWasConnected(false);
  }

  return {
    read,
    held,
    ended:
      wasConnected && read?.kind === "not-connected" && read.by !== "member",
    loading: query.isFetching,
    loadedAt: query.dataUpdatedAt,
    refetch: () => void query.refetch(),
  };
}

// The range the grid is showing, from what the panel and the page share.
export function useVisibleRange() {
  const current = useCalendarView();
  const now = useNow();
  const anchor = anchorOf(current, now);
  return {
    now,
    anchor,
    view: current.view,
    range: rangeOf(current.view, anchor),
  };
}

// Today's events for the Today list. The visible range often holds today
// already; only when it does not is a read of its own made.
export function useTodayEvents(
  cohortId: string,
  visible: CalendarRange,
  visibleEvents: readonly CalendarEvent[],
  now: Date,
): readonly CalendarEvent[] {
  const today = startOfDay(now);
  const covered = visible.start <= today && today < visible.end;
  const own = useCalendarRead(cohortId, rangeOf("day", today), !covered);

  if (covered) return visibleEvents;
  return own.data?.kind === "connected" ? own.data.events : [];
}
