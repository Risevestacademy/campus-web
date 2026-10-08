// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";
import type { Reply } from "@/tests/fixtures/mock-api";

import {
  createCohort,
  deleteCohort,
  editCohort,
  listCohorts,
} from "./cohort-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const API_ORIGIN = "https://api.example.test";
const COHORTS_URL = `${API_ORIGIN}/v1/cohorts`;

const cohortDto = (id: string, name: string, code: string) => ({
  id,
  name,
  code,
  startDate: "2026-09-01",
  endDate: null,
  status: "active",
  createdAt: "2026-09-22T12:00:00.000Z",
  updatedAt: "2026-09-22T12:00:00.000Z",
});

const page2of3 = {
  items: [
    cohortDto("c-9", "Cohort 9", "C9"),
    cohortDto("c-8", "Cohort 8", "C8"),
  ],
  meta: { page: 2, perPage: 2, total: 6, totalPages: 3 },
};

function backendReplies(reply: Reply) {
  mockApi.server.use(http.get(COHORTS_URL, reply));
  return mockApi.requests;
}

const api = createApiClient({ baseUrl: API_ORIGIN });

afterEach(() => {
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("listCohorts", () => {
  it("asks campus-api for the requested page", async () => {
    const sent = backendReplies(() => Response.json(page2of3));

    await listCohorts(api, 2);

    expect(sent.map((request) => request.url)).toEqual([
      `${COHORTS_URL}?page=2`,
    ]);
  });

  it("returns cohort summaries in backend order with the page position", async () => {
    backendReplies(() => Response.json(page2of3));

    await expect(listCohorts(api, 2)).resolves.toEqual({
      kind: "loaded",
      cohorts: [
        {
          id: "c-9",
          name: "Cohort 9",
          code: "C9",
          startDate: "2026-09-01",
          endDate: null,
          status: "active",
        },
        {
          id: "c-8",
          name: "Cohort 8",
          code: "C8",
          startDate: "2026-09-01",
          endDate: null,
          status: "active",
        },
      ],
      page: 2,
      totalPages: 3,
    });
  });

  it.each([401, 403, 429, 500, 503])(
    "reports HTTP %i as unavailable",
    async (code) => {
      backendReplies(() => new Response(null, { status: code }));

      await expect(listCohorts(api, 1)).resolves.toEqual({
        kind: "unavailable",
      });
    },
  );

  it("reports a network failure as unavailable", async () => {
    backendReplies(() => HttpResponse.error());

    await expect(listCohorts(api, 1)).resolves.toEqual({
      kind: "unavailable",
    });
  });

  it.each([
    [
      "invalid JSON",
      () =>
        new Response("{nope", {
          headers: { "content-type": "application/json" },
        }),
    ],
    ["a missing item list", () => Response.json({ meta: page2of3.meta })],
    [
      "a cohort without an ID",
      () =>
        Response.json({ ...page2of3, items: [{ name: "No ID", code: "X" }] }),
    ],
    [
      "missing page counts",
      () => Response.json({ items: page2of3.items, meta: { page: 2 } }),
    ],
  ])("reports %s as unavailable", async (_, reply) => {
    backendReplies(reply);

    await expect(listCohorts(api, 2)).resolves.toEqual({
      kind: "unavailable",
    });
  });
});

describe("createCohort", () => {
  const newCohort = {
    name: "Cohort 1",
    code: "C1",
    status: "upcoming" as const,
  };

  function backendAnswersCreate(reply: Reply) {
    mockApi.server.use(http.post(COHORTS_URL, reply));
  }

  it("reports a 201 as created", async () => {
    backendAnswersCreate(() => Response.json({}, { status: 201 }));

    await expect(createCohort(api, newCohort)).resolves.toEqual({
      kind: "created",
    });
  });

  it.each([
    [400, "rejected"],
    [401, "signed-out"],
    [403, "unavailable"],
    [409, "duplicate-code"],
    [500, "unavailable"],
  ])("reports HTTP %i as %s", async (status, problem) => {
    backendAnswersCreate(() =>
      Response.json(
        { error: { code: "SCRIPTED", message: "scripted" } },
        { status },
      ),
    );

    await expect(createCohort(api, newCohort)).resolves.toEqual({
      kind: "problem",
      problem,
    });
  });

  it("reports a network failure as unavailable", async () => {
    backendAnswersCreate(() => HttpResponse.error());

    await expect(createCohort(api, newCohort)).resolves.toEqual({
      kind: "problem",
      problem: "unavailable",
    });
  });
});

describe("editCohort", () => {
  const cohortUrl = `${API_ORIGIN}/v1/cohorts/cohort-1`;

  it("PATCHes only the supplied changes", async () => {
    const bodies: unknown[] = [];
    mockApi.server.use(
      http.patch(cohortUrl, async ({ request }) => {
        bodies.push(await request.json());
        return Response.json(cohortDto("cohort-1", "Renamed", "C2"));
      }),
    );

    await expect(
      editCohort(api, "cohort-1", {
        name: "Renamed",
        code: "C2",
        endDate: null,
      }),
    ).resolves.toEqual({ kind: "updated" });
    expect(bodies).toEqual([{ name: "Renamed", code: "C2", endDate: null }]);
  });

  it.each([
    [400, "invalid"],
    [401, "signed-out"],
    [403, "forbidden"],
    [404, "missing"],
    [409, "conflict"],
    [500, "unavailable"],
  ])("maps PATCH HTTP %i to %s", async (status, problem) => {
    mockApi.server.use(
      http.patch(cohortUrl, () => new Response(null, { status })),
    );

    await expect(
      editCohort(api, "cohort-1", { name: "Renamed" }),
    ).resolves.toEqual({ kind: "problem", problem });
  });

  it("maps a PATCH network failure to unavailable", async () => {
    mockApi.server.use(http.patch(cohortUrl, () => HttpResponse.error()));

    await expect(
      editCohort(api, "cohort-1", { name: "Renamed" }),
    ).resolves.toEqual({ kind: "problem", problem: "unavailable" });
  });
});

describe("deleteCohort", () => {
  const cohortUrl = `${API_ORIGIN}/v1/cohorts/cohort-1`;

  it("DELETEs only the named Cohort", async () => {
    mockApi.server.use(
      http.delete(cohortUrl, () => new Response(null, { status: 204 })),
    );

    await expect(deleteCohort(api, "cohort-1")).resolves.toEqual({
      kind: "deleted",
    });
    expect(mockApi.requests.map(({ method, url }) => [method, url])).toEqual([
      ["DELETE", cohortUrl],
    ]);
  });

  it.each([
    [400, "invalid"],
    [401, "signed-out"],
    [403, "forbidden"],
    [404, "missing"],
    [409, "conflict"],
    [500, "unavailable"],
  ])("maps DELETE HTTP %i to %s", async (status, problem) => {
    mockApi.server.use(
      http.delete(cohortUrl, () => new Response(null, { status })),
    );

    await expect(deleteCohort(api, "cohort-1")).resolves.toEqual({
      kind: "problem",
      problem,
    });
  });

  it("maps a DELETE network failure to unavailable", async () => {
    mockApi.server.use(http.delete(cohortUrl, () => HttpResponse.error()));

    await expect(deleteCohort(api, "cohort-1")).resolves.toEqual({
      kind: "problem",
      problem: "unavailable",
    });
  });
});
