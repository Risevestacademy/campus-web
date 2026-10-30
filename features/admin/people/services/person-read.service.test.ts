// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import { readPerson } from "./person-read.service";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const USERS_URL = `${API_ORIGIN}/v1/users`;
const api = createApiClient({ baseUrl: API_ORIGIN });

const ADA_ID = "3f0c2d1a-6b6e-4c4b-8f55-0c9d1e5a7b21";
const OTHER_ID = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";

function card(cohortIds: string[]) {
  return {
    id: ADA_ID,
    email: "ada@campus.local",
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: null,
    bio: "private",
    avatarUrl: null,
    spriteKey: null,
    memberships: cohortIds.map((id) => ({
      cohort: { id, name: `Cohort ${id}`, code: id.toUpperCase() },
      track: { id: "t-1", name: "Backend", code: "BE" },
      role: "student",
    })),
  };
}

function listItem(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    email: "ada@campus.local",
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: null,
    systemRole: "user",
    status: "active",
    memberships: [
      {
        cohort: { id: "c-1" },
        track: { name: "Backend" },
        role: "student",
      },
    ],
    ...overrides,
  };
}

function page(items: unknown[], pageNumber = 1, totalPages = 1) {
  return Response.json({
    items,
    meta: {
      page: pageNumber,
      perPage: 100,
      total: items.length * totalPages,
      totalPages,
    },
  });
}

function scriptCard(reply: () => Response) {
  mockApi.server.use(http.get(`${USERS_URL}/${ADA_ID}/profile`, reply));
}

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("reading a person in a cohort", () => {
  it("reads the account's own role and status from the cohort list", async () => {
    scriptCard(() => Response.json(card(["c-1"])));
    mockApi.server.use(
      http.get(USERS_URL, ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect(query.get("cohortId")).toBe("c-1");
        expect(query.get("search")).toBe("ada@campus.local");
        return page([
          listItem(OTHER_ID, { email: "ada@campus.local.uk" }),
          listItem(ADA_ID, { systemRole: "admin" }),
        ]);
      }),
    );

    expect(await readPerson(api, "c-1", ADA_ID)).toMatchObject({
      kind: "loaded",
      cohortName: "Cohort c-1",
      person: { id: ADA_ID, systemRole: "admin", role: "student" },
    });
  });

  it("does not show a person under a cohort they are not in", async () => {
    scriptCard(() => Response.json(card(["c-2"])));
    mockApi.server.use(
      http.get(USERS_URL, () => {
        throw new Error("the list is not read for a stranger");
      }),
    );

    expect(await readPerson(api, "c-1", ADA_ID)).toEqual({ kind: "missing" });
    expect(mockApi.requests.map(({ url }) => new URL(url).pathname)).toEqual([
      `/v1/users/${ADA_ID}/profile`,
    ]);
  });

  it("does not claim a suspended member is gone for good: the card is withheld", async () => {
    scriptCard(() => new HttpResponse(null, { status: 404 }));

    expect(await readPerson(api, "c-1", ADA_ID)).toEqual({ kind: "missing" });
  });

  it("is unavailable, not missing, when the card read fails or is refused", async () => {
    scriptCard(() => new HttpResponse(null, { status: 500 }));
    expect((await readPerson(api, "c-1", ADA_ID)).kind).toBe("unavailable");

    scriptCard(() => new HttpResponse(null, { status: 400 }));
    expect((await readPerson(api, "c-1", ADA_ID)).kind).toBe("unavailable");
  });

  it("finds a person who is on a later page of the address matches", async () => {
    scriptCard(() => Response.json(card(["c-1"])));
    mockApi.server.use(
      http.get(USERS_URL, ({ request }) => {
        const requested = Number(
          new URL(request.url).searchParams.get("page") ?? "1",
        );
        return requested === 1
          ? page([listItem(OTHER_ID)], 1, 3)
          : requested === 2
            ? page([listItem("another-id")], 2, 3)
            : page([listItem(ADA_ID)], 3, 3);
      }),
    );

    expect(await readPerson(api, "c-1", ADA_ID)).toMatchObject({
      kind: "loaded",
      person: { id: ADA_ID },
    });
    expect(
      mockApi.requests
        .map(({ url }) => new URL(url))
        .filter(({ pathname }) => pathname === "/v1/users")
        .map(({ searchParams }) => searchParams.get("page")),
    ).toEqual(["1", "2", "3"]);
  });

  it("stops at the last page when they are on none of them", async () => {
    scriptCard(() => Response.json(card(["c-1"])));
    mockApi.server.use(
      http.get(USERS_URL, ({ request }) =>
        page(
          [listItem(OTHER_ID)],
          Number(new URL(request.url).searchParams.get("page") ?? "1"),
          2,
        ),
      ),
    );

    expect((await readPerson(api, "c-1", ADA_ID)).kind).toBe("unavailable");
    expect(
      mockApi.requests.filter(
        ({ url }) => new URL(url).pathname === "/v1/users",
      ),
    ).toHaveLength(2);
  });

  it("is unavailable when the cohort list cannot say who they are", async () => {
    scriptCard(() => Response.json(card(["c-1"])));
    mockApi.server.use(
      http.get(USERS_URL, () => new HttpResponse(null, { status: 500 })),
    );
    expect((await readPerson(api, "c-1", ADA_ID)).kind).toBe("unavailable");

    mockApi.server.use(http.get(USERS_URL, () => page([])));
    expect((await readPerson(api, "c-1", ADA_ID)).kind).toBe("unavailable");
  });
});
