// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import { countPeople, listPeople, readPersonCard } from "./people-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const USERS_URL = `${API_ORIGIN}/v1/users`;
const api = createApiClient({ baseUrl: API_ORIGIN });

function page(items: unknown[], total = items.length) {
  return Response.json({
    items,
    meta: { page: 1, perPage: 20, total, totalPages: 1 },
  });
}

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("people API adapter", () => {
  it("asks for one cohort's people with the filters and page", async () => {
    mockApi.server.use(
      http.get(USERS_URL, ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect(query.get("cohortId")).toBe("c-1");
        expect(query.get("search")).toBe("ada");
        expect(query.get("cohortRole")).toBe("student");
        expect(query.get("page")).toBe("2");
        return page([]);
      }),
    );

    const read = await listPeople(
      api,
      "c-1",
      { search: "ada", cohortRole: "student" },
      2,
    );

    expect(read.kind).toBe("loaded");
  });

  it("counts with a page of one", async () => {
    mockApi.server.use(
      http.get(USERS_URL, ({ request }) => {
        expect(new URL(request.url).searchParams.get("perPage")).toBe("1");
        return page([], 14);
      }),
    );

    expect(await countPeople(api, "c-1", "professor")).toEqual({
      kind: "loaded",
      total: 14,
    });
  });

  it("is unavailable when the list fails or comes back malformed", async () => {
    mockApi.server.use(
      http.get(USERS_URL, () => new HttpResponse(null, { status: 500 })),
    );
    expect((await listPeople(api, "c-1", {}, 1)).kind).toBe("unavailable");

    mockApi.server.use(http.get(USERS_URL, () => Response.json({ items: 1 })));
    expect((await listPeople(api, "c-1", {}, 1)).kind).toBe("unavailable");
  });

  it("reads a person's card, and reports a missing one", async () => {
    mockApi.server.use(
      http.get(`${USERS_URL}/user-1/profile`, () =>
        Response.json({
          id: "user-1",
          email: "ada@campus.local",
          firstName: "Ada",
          lastName: null,
          displayName: null,
          memberships: [],
        }),
      ),
      http.get(
        `${USERS_URL}/gone/profile`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    expect((await readPersonCard(api, "user-1")).kind).toBe("loaded");
    expect((await readPersonCard(api, "gone")).kind).toBe("missing");
  });
});
