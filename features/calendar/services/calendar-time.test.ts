import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "../schemas/calendar-events.schema";
import {
  allDayPlacement,
  boundsOf,
  eventOnDay,
  filterEvents,
  isLive,
  layoutOverlaps,
  monthCells,
  segmentsOf,
  todayList,
} from "./calendar-time";
import { daysOf, rangeOf } from "./calendar-window";

process.env.TZ = "Europe/London";

const BASE = {
  id: "e-1",
  allDay: false,
  status: "confirmed",
  response: "accepted",
} as const;

function busy(start: string, end: string, extra = {}): CalendarEvent {
  return { ...BASE, kind: "busy", start, end, ...extra };
}

function campus(start: string, end: string, extra = {}): CalendarEvent {
  return {
    ...BASE,
    kind: "campus",
    start,
    end,
    title: "Design review",
    location: null,
    googleUrl: null,
    room: { code: "k3F9xQ2pLm", spaceName: "Pod A" },
    ...extra,
  };
}

// Monday 28 September to Sunday 4 October 2026, in London (BST).
const WEEK = daysOf(rangeOf("week", new Date(2026, 8, 30)));

describe("segmentsOf", () => {
  it("places an event on its day by the wall clock", () => {
    const bounds = boundsOf(
      busy("2026-09-30T14:00:00+01:00", "2026-09-30T15:30:00+01:00"),
    );

    expect(segmentsOf(bounds, WEEK)).toEqual([
      { dayIndex: 2, startMinute: 14 * 60, endMinute: 15 * 60 + 30 },
    ]);
  });

  it("draws an event that spans midnight on each day, cut at midnight", () => {
    const bounds = boundsOf(
      busy("2026-09-30T22:00:00+01:00", "2026-10-01T02:00:00+01:00"),
    );

    expect(segmentsOf(bounds, WEEK)).toEqual([
      { dayIndex: 2, startMinute: 22 * 60, endMinute: 24 * 60 },
      { dayIndex: 3, startMinute: 0, endMinute: 2 * 60 },
    ]);
  });

  it("does not draw an event that ends exactly at midnight on the next day", () => {
    const bounds = boundsOf(
      busy("2026-09-30T22:00:00+01:00", "2026-10-01T00:00:00+01:00"),
    );

    expect(segmentsOf(bounds, WEEK).map((s) => s.dayIndex)).toEqual([2]);
  });

  it("keeps the hours put on the day the clocks go back", () => {
    // Sunday 25 October 2026: 02:00 BST becomes 01:00 GMT, a 25-hour day.
    const days = daysOf(rangeOf("week", new Date(2026, 9, 25)));
    const bounds = boundsOf(
      busy("2026-10-25T09:00:00+00:00", "2026-10-25T10:00:00+00:00"),
    );

    expect(segmentsOf(bounds, days)).toEqual([
      { dayIndex: 6, startMinute: 9 * 60, endMinute: 10 * 60 },
    ]);
  });

  it("gives an event with no length a sliver that can be pressed", () => {
    const bounds = boundsOf(
      busy("2026-09-30T09:00:00+01:00", "2026-09-30T09:00:00+01:00"),
    );

    const [segment] = segmentsOf(bounds, WEEK);

    expect((segment?.endMinute ?? 0) - (segment?.startMinute ?? 0)).toBe(20);
  });
});

describe("all-day events", () => {
  const allDay = (start: string, end: string) =>
    busy(start, end, { allDay: true });

  it("reads its dates as days, whatever the zone", () => {
    const { start, end } = boundsOf(allDay("2026-09-30", "2026-10-01"));

    expect(start).toEqual(new Date(2026, 8, 30));
    expect(end).toEqual(new Date(2026, 9, 1));
  });

  it("covers the days from its start to the day before its end", () => {
    const bounds = boundsOf(allDay("2026-09-29", "2026-10-02"));

    expect(allDayPlacement(bounds, WEEK)).toEqual({
      startIndex: 1,
      endIndex: 3,
    });
  });

  it("is cut to the days shown", () => {
    const bounds = boundsOf(allDay("2026-09-25", "2026-09-30"));

    expect(allDayPlacement(bounds, WEEK)).toEqual({
      startIndex: 0,
      endIndex: 1,
    });
  });

  it("is not placed in a week it does not touch", () => {
    const bounds = boundsOf(allDay("2026-10-12", "2026-10-13"));

    expect(allDayPlacement(bounds, WEEK)).toBeUndefined();
  });

  it("is on the day it names and not the one after", () => {
    const event = allDay("2026-09-30", "2026-10-01");

    expect(eventOnDay(event, new Date(2026, 8, 30))).toBe(true);
    expect(eventOnDay(event, new Date(2026, 9, 1))).toBe(false);
  });
});

describe("layoutOverlaps", () => {
  const item = (startMinute: number, endMinute: number) => ({
    startMinute,
    endMinute,
  });

  it("gives a lone event the whole column", () => {
    expect(layoutOverlaps([item(60, 120)])).toEqual([
      { ...item(60, 120), lane: 0, lanes: 1 },
    ]);
  });

  it("puts two overlapping events side by side", () => {
    const laid = layoutOverlaps([item(60, 180), item(120, 240)]);

    expect(laid.map(({ lane, lanes }) => [lane, lanes])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });

  it("reuses a lane once its event has ended, within the same overlap", () => {
    const laid = layoutOverlaps([item(0, 120), item(30, 60), item(60, 150)]);

    expect(laid.map(({ lane }) => lane)).toEqual([0, 1, 1]);
    expect(laid.every(({ lanes }) => lanes === 2)).toBe(true);
  });

  it("does not narrow events that only touch", () => {
    const laid = layoutOverlaps([item(0, 60), item(60, 120)]);

    expect(laid.every(({ lanes }) => lanes === 1)).toBe(true);
  });
});

describe("isLive", () => {
  const event = campus(
    "2026-09-30T14:00:00+01:00",
    "2026-09-30T15:00:00+01:00",
  );
  const at = (hour: number, minute: number) =>
    new Date(2026, 8, 30, hour, minute);

  it.each([
    [at(13, 49), false],
    [at(13, 50), true],
    [at(14, 30), true],
    [at(14, 59), true],
    [at(15, 0), false],
  ])("at %s: %s", (now, live) => {
    expect(isLive(event, now)).toBe(live);
  });

  it("is never live for an event with no room", () => {
    expect(
      isLive(
        busy("2026-09-30T14:00:00+01:00", "2026-09-30T15:00:00+01:00"),
        at(14, 30),
      ),
    ).toBe(false);
  });
});

describe("todayList", () => {
  it("keeps today's events that carry a room, soonest first", () => {
    const events = [
      campus("2026-09-30T16:00:00+01:00", "2026-09-30T17:00:00+01:00", {
        id: "later",
      }),
      busy("2026-09-30T09:00:00+01:00", "2026-09-30T10:00:00+01:00"),
      campus("2026-10-01T09:00:00+01:00", "2026-10-01T10:00:00+01:00", {
        id: "tomorrow",
      }),
      campus("2026-09-30T11:00:00+01:00", "2026-09-30T12:00:00+01:00", {
        id: "earlier",
      }),
    ];

    expect(
      todayList(events, new Date(2026, 8, 30, 8)).map(({ id }) => id),
    ).toEqual(["earlier", "later"]);
  });
});

describe("monthCells", () => {
  it("shows three events a day and counts the rest", () => {
    const events = [1, 2, 3, 4, 5].map((n) =>
      campus("2026-09-30T09:00:00+01:00", "2026-09-30T10:00:00+01:00", {
        id: `e-${n}`,
      }),
    );
    const days = daysOf(rangeOf("month", new Date(2026, 8, 30)));

    const cell = monthCells(
      events,
      days,
      new Date(2026, 8, 30),
      new Date(),
    ).find(({ day }) => day.getDate() === 30 && day.getMonth() === 8);

    expect(cell?.shown).toHaveLength(3);
    expect(cell?.more).toBe(2);
  });

  it("marks the days outside the month", () => {
    const days = daysOf(rangeOf("month", new Date(2026, 8, 30)));

    const cells = monthCells([], days, new Date(2026, 8, 30), new Date());

    expect(cells[0]?.inMonth).toBe(false);
    expect(cells.filter(({ inMonth }) => inMonth)).toHaveLength(30);
  });
});

describe("filterEvents", () => {
  const events = [
    campus("2026-09-30T09:00:00+01:00", "2026-09-30T10:00:00+01:00"),
    busy("2026-09-30T11:00:00+01:00", "2026-09-30T12:00:00+01:00"),
  ];

  it.each([
    [{ campus: true, busy: true }, 2],
    [{ campus: true, busy: false }, 1],
    [{ campus: false, busy: true }, 1],
    [{ campus: false, busy: false }, 0],
  ])("with %j leaves %i", (filters, count) => {
    expect(filterEvents(events, filters)).toHaveLength(count);
  });
});
