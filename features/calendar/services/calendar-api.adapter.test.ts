// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client/create-api-client";

import { disconnectCalendar, readCalendarEvents } from "./calendar-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const API_ORIGIN = "https://api.example.test";
const EVENTS_URL = `${API_ORIGIN}/v1/calendar/events`;
const CALENDAR_URL = `${API_ORIGIN}/v1/calendar`;
const api = () => createApiClient({ baseUrl: API_ORIGIN });
const WINDOW = {
  from: "2026-09-27T23:00:00.000Z",
  to: "2026-10-04T23:00:00.000Z",
};

const ROOM = {
  code: "k3F9xQ2pLm",
  cohortId: "c-1",
  spaceId: "s-1",
  spaceKey: "pod-a",
  spaceName: "Pod A",
  title: "Design review",
};

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "e-1",
    title: "Design review",
    start: "2026-09-30T14:00:00+01:00",
    end: "2026-09-30T15:00:00+01:00",
    allDay: false,
    status: "confirmed",
    response: "accepted",
    location: "Room 2",
    meetingUrl: "https://meet.google.com/abc-defg-hij",
    url: "https://www.google.com/calendar/event?eid=abc",
    room: null,
    ...overrides,
  };
}

function answer(events: unknown[]) {
  return { connected: true, truncated: false, events };
}

afterEach(() => {
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("readCalendarEvents", () => {
  it("asks for the window it was given", async () => {
    let asked: URLSearchParams | undefined;
    mockApi.server.use(
      http.get(EVENTS_URL, ({ request }) => {
        asked = new URL(request.url).searchParams;
        return HttpResponse.json({
          connected: true,
          events: [],
          truncated: false,
        });
      }),
    );

    await readCalendarEvents(api(), WINDOW, "c-1");

    expect(asked?.get("from")).toBe(WINDOW.from);
    expect(asked?.get("to")).toBe(WINDOW.to);
  });

  it.each([
    [true, { kind: "connected", events: [], truncated: false }],
    [false, { kind: "not-connected" }],
  ] as const)("reads connected: %s", async (connected, expected) => {
    mockApi.server.use(
      http.get(EVENTS_URL, () =>
        HttpResponse.json({ connected, events: [], truncated: false }),
      ),
    );

    await expect(readCalendarEvents(api(), WINDOW, "c-1")).resolves.toEqual(
      expected,
    );
  });

  it("keeps the words of an event held in a room of this cohort", async () => {
    mockApi.server.use(
      http.get(EVENTS_URL, () =>
        HttpResponse.json(answer([event({ room: ROOM })])),
      ),
    );

    const result = await readCalendarEvents(api(), WINDOW, "c-1");

    expect(result).toMatchObject({
      kind: "connected",
      events: [
        {
          kind: "campus",
          title: "Design review",
          location: "Room 2",
          room: { code: "k3F9xQ2pLm", spaceName: "Pod A" },
          googleUrl: "https://www.google.com/calendar/event?eid=abc",
        },
      ],
    });
  });

  it.each([
    ["no room", null],
    ["a room in another cohort", { ...ROOM, cohortId: "c-2" }],
  ])("reduces an event with %s to its times", async (_, room) => {
    mockApi.server.use(
      http.get(EVENTS_URL, () =>
        HttpResponse.json(
          answer([
            event({
              room,
              title: "Private dentist appointment",
              location: "12 Hospital Road",
            }),
          ]),
        ),
      ),
    );

    const result = await readCalendarEvents(api(), WINDOW, "c-1");

    expect(result).toEqual({
      kind: "connected",
      truncated: false,
      events: [
        {
          kind: "busy",
          id: "e-1",
          start: "2026-09-30T14:00:00+01:00",
          end: "2026-09-30T15:00:00+01:00",
          allDay: false,
          status: "confirmed",
          response: "accepted",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /dentist|Hospital|meet\.google|calendar\/event|Pod A|k3F9xQ2pLm/,
    );
  });

  it("drops the meeting link", async () => {
    mockApi.server.use(
      http.get(EVENTS_URL, () =>
        HttpResponse.json(answer([event({ room: ROOM })])),
      ),
    );

    const result = await readCalendarEvents(api(), WINDOW, "c-1");

    expect(JSON.stringify(result)).not.toContain("meet.google.com");
  });

  it.each([
    "http://www.google.com/calendar/event?eid=abc",
    "https://evil.example/calendar/event",
    "https://google.com.evil.example/x",
    "javascript:alert(1)",
    "not a url",
  ])("never offers %s as a Google link", async (url) => {
    mockApi.server.use(
      http.get(EVENTS_URL, () =>
        HttpResponse.json(answer([event({ room: ROOM, url })])),
      ),
    );

    const result = await readCalendarEvents(api(), WINDOW, "c-1");

    expect(result).toMatchObject({ events: [{ googleUrl: null }] });
  });

  it("skips an event it cannot read and keeps the others", async () => {
    mockApi.server.use(
      http.get(EVENTS_URL, () =>
        HttpResponse.json(
          answer([
            { id: "bad", start: "yesterday" },
            event({ id: "e-2", room: ROOM }),
          ]),
        ),
      ),
    );

    const result = await readCalendarEvents(api(), WINDOW, "c-1");

    expect(result).toMatchObject({ events: [{ id: "e-2" }] });
  });

  it("passes on that campus-api cut the list short", async () => {
    mockApi.server.use(
      http.get(EVENTS_URL, () =>
        HttpResponse.json({ ...answer([]), truncated: true }),
      ),
    );

    await expect(
      readCalendarEvents(api(), WINDOW, "c-1"),
    ).resolves.toMatchObject({ truncated: true });
  });

  it("says the session ended on a 401", async () => {
    mockApi.server.use(
      http.get(EVENTS_URL, () => new Response(null, { status: 401 })),
    );

    await expect(readCalendarEvents(api(), WINDOW, "c-1")).resolves.toEqual({
      kind: "signed-out",
    });
  });

  it.each([
    ["Google not answering", () => new Response(null, { status: 503 })],
    [
      "the calendar being switched off",
      () => new Response(null, { status: 404 }),
    ],
    ["a network failure", () => HttpResponse.error()],
    ["an answer that is not a status", () => HttpResponse.json({ ok: true })],
  ])("is unavailable after %s", async (_, reply) => {
    mockApi.server.use(http.get(EVENTS_URL, reply));

    await expect(readCalendarEvents(api(), WINDOW, "c-1")).resolves.toEqual({
      kind: "unavailable",
    });
  });
});

describe("disconnectCalendar", () => {
  it("disconnects on a 204", async () => {
    mockApi.server.use(
      http.delete(CALENDAR_URL, () => new Response(null, { status: 204 })),
    );

    await expect(disconnectCalendar(api())).resolves.toBe("disconnected");
  });

  it("says the session ended on a 401", async () => {
    mockApi.server.use(
      http.delete(CALENDAR_URL, () => new Response(null, { status: 401 })),
    );

    await expect(disconnectCalendar(api())).resolves.toBe("signed-out");
  });

  it.each([
    ["a server error", () => new Response(null, { status: 500 })],
    ["a network failure", () => HttpResponse.error()],
  ])("fails after %s", async (_, reply) => {
    mockApi.server.use(http.delete(CALENDAR_URL, reply));

    await expect(disconnectCalendar(api())).resolves.toBe("failed");
  });
});
