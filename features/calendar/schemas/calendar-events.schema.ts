import { z } from "zod";

import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

type Schemas = components["schemas"];

// What the calendar reads of one event. The meeting link, and everything else
// campus-api sends, is dropped where the answer is parsed.
type RawRoom = Simplify<
  Pick<Schemas["RoomLinkTargetDto"], "code" | "cohortId" | "spaceName">
>;
type RawEvent = Simplify<
  Pick<
    Schemas["CalendarEventDto"],
    | "id"
    | "title"
    | "start"
    | "end"
    | "allDay"
    | "status"
    | "response"
    | "location"
    | "url"
  > & { room: RawRoom | null }
>;

const ROOM_LINK_CODE = /^[A-Za-z0-9]{10}$/;
const MAX_TEXT = 300;

// A timestamp with the zone Google gave it, or a plain date for all-day.
const instantSchema = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

const roomSchema = z.toZod<RawRoom>()(
  z.object({
    code: z.string().regex(ROOM_LINK_CODE),
    cohortId: z.string().min(1).max(64),
    spaceName: z.string().max(MAX_TEXT),
  }),
);

const rawEventSchema = z.toZod<RawEvent>()(
  z.object({
    id: z.string().min(1).max(1024),
    title: z.string().max(MAX_TEXT).nullable(),
    start: instantSchema,
    end: instantSchema,
    allDay: z.boolean(),
    status: z.enum(["confirmed", "tentative"]),
    response: z
      .enum(["accepted", "tentative", "declined", "needsAction"])
      .nullable(),
    location: z.string().max(MAX_TEXT).nullable(),
    url: z.string().max(2048).nullable(),
    room: roomSchema.nullable(),
  }),
);

// The answer's own shape. Its events are parsed one by one, so a single event
// campus does not understand never hides the rest.
const eventsAnswerSchema = z.object({
  connected: z.boolean(),
  truncated: z.boolean(),
  events: z.array(z.unknown()),
});

export type CalendarRoom = Readonly<{
  code: string;
  spaceName: string;
}>;

type EventTimes = Readonly<{
  id: string;
  start: string;
  end: string;
  allDay: boolean;
  status: "confirmed" | "tentative";
  response: RawEvent["response"];
}>;

// An event that carries a room this cohort may open keeps its words.
export type CampusEvent = EventTimes &
  Readonly<{
    kind: "campus";
    title: string | null;
    location: string | null;
    // Only ever a Google address, checked before it can reach an href.
    googleUrl: string | null;
    room: CalendarRoom;
  }>;

// Any other event is only a time: its title, place and links never leave the
// parser.
export type BusyEvent = EventTimes & Readonly<{ kind: "busy" }>;

export type CalendarEvent = CampusEvent | BusyEvent;

export type CalendarEvents = Readonly<{
  connected: boolean;
  truncated: boolean;
  events: readonly CalendarEvent[];
}>;

function googleAddress(value: string | null): string | null {
  if (value === null) return null;
  try {
    const url = new URL(value);
    const google =
      url.hostname === "google.com" || url.hostname.endsWith(".google.com");
    return url.protocol === "https:" && google ? url.href : null;
  } catch {
    return null;
  }
}

function toEvent(raw: RawEvent, cohortId: string): CalendarEvent {
  const times: EventTimes = {
    id: raw.id,
    start: raw.start,
    end: raw.end,
    allDay: raw.allDay,
    status: raw.status,
    response: raw.response,
  };
  // Decision 7: a room in another cohort is not this cohort's to show.
  if (raw.room === null || raw.room.cohortId !== cohortId) {
    return { ...times, kind: "busy" };
  }
  return {
    ...times,
    kind: "campus",
    title: raw.title,
    location: raw.location,
    googleUrl: googleAddress(raw.url),
    room: { code: raw.room.code, spaceName: raw.room.spaceName },
  };
}

export function parseCalendarEvents(
  value: unknown,
  cohortId: string,
): CalendarEvents | undefined {
  const answer = eventsAnswerSchema.safeParse(value);
  if (!answer.success) return undefined;

  const events: CalendarEvent[] = [];
  for (const candidate of answer.data.events) {
    const parsed = rawEventSchema.safeParse(candidate);
    if (parsed.success) events.push(toEvent(parsed.data, cohortId));
  }
  return {
    connected: answer.data.connected,
    truncated: answer.data.truncated,
    events,
  };
}
