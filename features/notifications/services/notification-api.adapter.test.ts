// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client/create-api-client";

import {
  markAllNotificationsRead,
  markNotificationRead,
  readNotificationPage,
  readUnreadCount,
} from "./notification-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const API_ORIGIN = "https://api.example.test";
const LIST_URL = `${API_ORIGIN}/v1/notifications`;
const api = createApiClient({ baseUrl: API_ORIGIN });

const item = (id: string, read = false) => ({
  id,
  kind: "notice_posted",
  referenceType: "notice",
  referenceId: "x",
  context: null,
  read,
  createdAt: "2026-11-11T10:00:00.000Z",
});

function page(items: unknown[], total = items.length, pageNumber = 1) {
  return {
    items,
    meta: { page: pageNumber, perPage: 20, total, totalPages: 1 },
  };
}

afterEach(() => {
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("readNotificationPage", () => {
  it("asks for the page, 20 to a page, and returns what it parsed", async () => {
    let asked = "";
    mockApi.server.use(
      http.get(LIST_URL, ({ request }) => {
        asked = new URL(request.url).search;
        return HttpResponse.json(page([item("n-1")], 41, 2));
      }),
    );

    const read = await readNotificationPage(api, { page: 2 });

    expect(asked).toBe("?page=2&perPage=20");
    expect(read).toMatchObject({
      kind: "loaded",
      page: 2,
      total: 41,
      notifications: [{ id: "n-1" }],
    });
  });

  it("asks only for the unread when told to", async () => {
    let asked = "";
    mockApi.server.use(
      http.get(LIST_URL, ({ request }) => {
        asked = new URL(request.url).search;
        return HttpResponse.json(page([]));
      }),
    );

    await readNotificationPage(api, { page: 1, unread: true }, 1);

    expect(asked).toBe("?page=1&perPage=1&unread=true");
  });

  it.each([
    ["a server error", () => new Response(null, { status: 503 })],
    ["a session that ended", () => new Response(null, { status: 401 })],
    ["a network failure", () => HttpResponse.error()],
    ["a reply that is not a page", () => HttpResponse.json({ ok: true })],
  ])("is unavailable after %s", async (_, reply) => {
    mockApi.server.use(http.get(LIST_URL, reply));

    await expect(readNotificationPage(api, { page: 1 })).resolves.toEqual({
      kind: "unavailable",
    });
  });
});

describe("readUnreadCount", () => {
  it("is the total of a page of one", async () => {
    mockApi.server.use(
      http.get(LIST_URL, () => HttpResponse.json(page([item("n-1")], 7))),
    );

    await expect(readUnreadCount(api)).resolves.toBe(7);
  });

  it("is unknown, not zero, when it cannot be read", async () => {
    mockApi.server.use(
      http.get(LIST_URL, () => new Response(null, { status: 500 })),
    );

    await expect(readUnreadCount(api)).resolves.toBeUndefined();
  });
});

describe("markNotificationRead", () => {
  it("marks one read", async () => {
    mockApi.server.use(
      http.patch(`${LIST_URL}/n-1/read`, () =>
        HttpResponse.json({ ...item("n-1", true) }),
      ),
    );

    await expect(markNotificationRead(api, "n-1")).resolves.toEqual({
      kind: "marked",
    });
  });

  it("says one that is gone is missing", async () => {
    mockApi.server.use(
      http.patch(
        `${LIST_URL}/n-1/read`,
        () => new Response(null, { status: 404 }),
      ),
    );

    await expect(markNotificationRead(api, "n-1")).resolves.toEqual({
      kind: "problem",
      problem: "missing",
    });
  });

  it.each([
    ["a server error", () => new Response(null, { status: 500 })],
    ["a network failure", () => HttpResponse.error()],
  ])("is unavailable after %s", async (_, reply) => {
    mockApi.server.use(http.patch(`${LIST_URL}/n-1/read`, reply));

    await expect(markNotificationRead(api, "n-1")).resolves.toEqual({
      kind: "problem",
      problem: "unavailable",
    });
  });
});

describe("markAllNotificationsRead", () => {
  it("marks all read", async () => {
    mockApi.server.use(
      http.post(`${LIST_URL}/read-all`, () => HttpResponse.json({ marked: 3 })),
    );

    await expect(markAllNotificationsRead(api)).resolves.toEqual({
      kind: "marked",
    });
  });

  it("is unavailable after a failure", async () => {
    mockApi.server.use(
      http.post(
        `${LIST_URL}/read-all`,
        () => new Response(null, { status: 500 }),
      ),
    );

    await expect(markAllNotificationsRead(api)).resolves.toEqual({
      kind: "problem",
      problem: "unavailable",
    });
  });
});
