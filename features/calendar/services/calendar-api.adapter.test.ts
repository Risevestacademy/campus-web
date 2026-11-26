// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client/create-api-client";

import { disconnectCalendar, readCalendarStatus } from "./calendar-api.adapter";

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

afterEach(() => {
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("readCalendarStatus", () => {
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

    await readCalendarStatus(api(), WINDOW);

    expect(asked?.get("from")).toBe(WINDOW.from);
    expect(asked?.get("to")).toBe(WINDOW.to);
  });

  it.each([
    [true, "connected"],
    [false, "not-connected"],
  ] as const)("reads connected: %s", async (connected, kind) => {
    mockApi.server.use(
      http.get(EVENTS_URL, () =>
        HttpResponse.json({ connected, events: [], truncated: false }),
      ),
    );

    await expect(readCalendarStatus(api(), WINDOW)).resolves.toEqual({ kind });
  });

  it("returns only the status, whatever events came with it", async () => {
    mockApi.server.use(
      http.get(EVENTS_URL, () =>
        HttpResponse.json({
          connected: true,
          truncated: false,
          events: [{ id: "e-1", title: "Private dentist appointment" }],
        }),
      ),
    );

    const result = await readCalendarStatus(api(), WINDOW);

    expect(JSON.stringify(result)).not.toContain("dentist");
  });

  it("says the session ended on a 401", async () => {
    mockApi.server.use(
      http.get(EVENTS_URL, () => new Response(null, { status: 401 })),
    );

    await expect(readCalendarStatus(api(), WINDOW)).resolves.toEqual({
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

    await expect(readCalendarStatus(api(), WINDOW)).resolves.toEqual({
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
