// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import {
  countFeedback,
  listFeedback,
  readFeedback,
  setFeedbackStatus,
} from "./feedback-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const FEEDBACK_URL = `${API_ORIGIN}/v1/feedback`;
const api = createApiClient({ baseUrl: API_ORIGIN });
const person = {
  id: "user-1",
  email: "ada@campus.local",
  displayName: "Ada Lovelace",
};

function summary(id: string, type: string, createdAt: string) {
  return {
    id,
    type,
    title: `Title ${id}`,
    about: null,
    status: "open",
    submittedBy: person,
    reportedUser: null,
    createdAt,
  };
}

function page(items: unknown[], total = items.length) {
  return Response.json({
    items,
    meta: { page: 1, perPage: 20, total, totalPages: 1 },
  });
}

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("feedback API adapter", () => {
  it("lists one type with the API's own pagination", async () => {
    mockApi.server.use(
      http.get(FEEDBACK_URL, ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect(query.get("type")).toBe("report");
        expect(query.get("status")).toBe("open");
        expect(query.get("page")).toBe("2");
        return page([summary("r1", "report", "2026-10-12T10:00:00.000Z")]);
      }),
    );

    const read = await listFeedback(api, {
      types: ["report"],
      status: "open",
      page: 2,
    });

    expect(read).toMatchObject({ kind: "loaded", truncated: false });
    expect(mockApi.requests).toHaveLength(1);
  });

  it("merges bugs and ideas newest first", async () => {
    mockApi.server.use(
      http.get(FEEDBACK_URL, ({ request }) => {
        const type = new URL(request.url).searchParams.get("type");
        return type === "bug"
          ? page([
              summary("b1", "bug", "2026-10-10T10:00:00.000Z"),
              summary("b2", "bug", "2026-10-08T10:00:00.000Z"),
            ])
          : page([summary("i1", "idea", "2026-10-09T10:00:00.000Z")]);
      }),
    );

    const read = await listFeedback(api, { types: ["bug", "idea"], page: 1 });

    expect(read.kind).toBe("loaded");
    if (read.kind !== "loaded") return;
    expect(read.items.map((item) => item.id)).toEqual(["b1", "i1", "b2"]);
    expect(read.total).toBe(3);
    expect(read.truncated).toBe(false);
  });

  it("says when a merged queue is cut off", async () => {
    mockApi.server.use(
      http.get(FEEDBACK_URL, () =>
        page([summary("b1", "bug", "2026-10-10T10:00:00.000Z")], 150),
      ),
    );

    const read = await listFeedback(api, { types: ["bug", "idea"], page: 1 });

    expect(read).toMatchObject({ kind: "loaded", truncated: true });
  });

  it("is unavailable when any part of a merged queue fails", async () => {
    mockApi.server.use(
      http.get(FEEDBACK_URL, ({ request }) =>
        new URL(request.url).searchParams.get("type") === "bug"
          ? page([])
          : new Response(null, { status: 500 }),
      ),
    );

    await expect(
      listFeedback(api, { types: ["bug", "idea"], page: 1 }),
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("counts from the total of a single-item page", async () => {
    mockApi.server.use(
      http.get(FEEDBACK_URL, ({ request }) => {
        expect(new URL(request.url).searchParams.get("perPage")).toBe("1");
        return page([summary("b1", "bug", "2026-10-10T10:00:00.000Z")], 7);
      }),
    );

    await expect(countFeedback(api, { type: "bug" })).resolves.toEqual({
      kind: "loaded",
      total: 7,
    });
  });

  it("reads one record and tells a missing one apart", async () => {
    mockApi.server.use(
      http.get(`${FEEDBACK_URL}/fb-1`, () =>
        HttpResponse.json({
          ...summary("fb-1", "bug", "2026-10-10T10:00:00.000Z"),
          details: "It broke",
          cohortId: null,
          context: { path: "/campus" },
          userAgent: null,
          resolvedBy: null,
          resolvedAt: null,
        }),
      ),
      http.get(
        `${FEEDBACK_URL}/gone`,
        () => new Response(null, { status: 404 }),
      ),
    );

    await expect(readFeedback(api, "fb-1")).resolves.toMatchObject({
      kind: "loaded",
    });
    await expect(readFeedback(api, "gone")).resolves.toEqual({
      kind: "missing",
    });
  });

  it("maps each status change outcome", async () => {
    mockApi.server.use(
      http.patch(`${FEEDBACK_URL}/ok`, async ({ request }) => {
        expect(await request.json()).toEqual({ status: "resolved" });
        return HttpResponse.json({});
      }),
      http.patch(
        `${FEEDBACK_URL}/denied`,
        () => new Response(null, { status: 403 }),
      ),
      http.patch(
        `${FEEDBACK_URL}/signed-out`,
        () => new Response(null, { status: 401 }),
      ),
      http.patch(
        `${FEEDBACK_URL}/boom`,
        () => new Response(null, { status: 500 }),
      ),
    );

    await expect(setFeedbackStatus(api, "ok", "resolved")).resolves.toEqual({
      kind: "updated",
    });
    await expect(setFeedbackStatus(api, "denied", "open")).resolves.toEqual({
      kind: "problem",
      problem: "forbidden",
    });
    await expect(setFeedbackStatus(api, "signed-out", "open")).resolves.toEqual(
      {
        kind: "problem",
        problem: "signed-out",
      },
    );
    await expect(setFeedbackStatus(api, "boom", "open")).resolves.toEqual({
      kind: "problem",
      problem: "unavailable",
    });
  });
});
