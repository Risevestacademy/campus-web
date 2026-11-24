import type { CalendarEvent } from "../schemas/calendar-events.schema";
import { filterEvents } from "../services/calendar-time";
import { useCalendarView } from "../store/calendar-view-store";
import {
  type CalendarEventsState,
  useCalendarEvents,
  useVisibleRange,
} from "./use-calendar-events";

export type CalendarModel = CalendarEventsState &
  ReturnType<typeof useVisibleRange> & {
    filters: ReturnType<typeof useCalendarView>["filters"];
    // The events to draw: this range's, or the last that did arrive when
    // Google has stopped answering. All of them, before the filters.
    events: readonly CalendarEvent[];
    shown: readonly CalendarEvent[];
    dimmed: boolean;
  };

// Everything the panel and the page agree on: the visible range, what was read
// for it, and what the filters leave of that.
export function useCalendarModel(cohortId: string): CalendarModel {
  const visible = useVisibleRange();
  const { filters } = useCalendarView();
  const events = useCalendarEvents(cohortId, visible.range);
  const { read, held } = events;

  const source =
    read?.kind === "connected"
      ? read.events
      : read?.kind === "unavailable"
        ? (held?.events ?? [])
        : [];

  return {
    ...events,
    ...visible,
    filters,
    events: source,
    shown: filterEvents(source, filters),
    dimmed: read?.kind === "unavailable",
  };
}
