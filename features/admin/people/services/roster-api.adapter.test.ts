// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import { countFormerMembers, listFormerMembers } from "./roster-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const ROSTER_URL = `${API_ORIGIN}/v1/cohorts/c-1/members`;
const api = createApiClient({ baseUrl: API_ORIGIN });

function page(total = 0) {
  return Response.json({
    items: [],
    meta: { page: 1, perPage: 20, total, totalPages: 1 },
  });
}

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("roster API adapter", () => {
  it("asks for the cohort's ended memberships with the filters and page", async () => {
    mockApi.server.use(
      http.get(ROSTER_URL, ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect(query.get("state")).toBe("ended");
        expect(query.get("role")).toBe("student");
        expect(query.get("trackId")).toBe("t-1");
        expect(query.get("page")).toBe("3");
        return page();
      }),
    );

    const read = await listFormerMembers(
      api,
      "c-1",
      { role: "student", trackId: "t-1" },
      3,
    );

    expect(read.kind).toBe("loaded");
  });

  it("counts with a page of one", async () => {
    mockApi.server.use(
      http.get(ROSTER_URL, ({ request }) => {
        expect(new URL(request.url).searchParams.get("perPage")).toBe("1");
        return page(9);
      }),
    );

    expect(await countFormerMembers(api, "c-1", "guest")).toEqual({
      kind: "loaded",
      total: 9,
    });
  });

  it("is unavailable when the roster fails or comes back malformed", async () => {
    mockApi.server.use(
      http.get(ROSTER_URL, () => new HttpResponse(null, { status: 404 })),
    );
    expect((await listFormerMembers(api, "c-1", {}, 1)).kind).toBe(
      "unavailable",
    );

    mockApi.server.use(http.get(ROSTER_URL, () => Response.json({ items: 1 })));
    expect((await listFormerMembers(api, "c-1", {}, 1)).kind).toBe(
      "unavailable",
    );
  });
});
