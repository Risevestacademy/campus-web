// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import {
  listSpaces,
  publishMap,
  readEntryMap,
  syncMaps,
  updateSpace,
} from "./maps-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const api = createApiClient({ baseUrl: API_ORIGIN });
const SPACE_ID = "11111111-1111-4111-8111-111111111111";
const MAP_ID = "22222222-2222-4222-8222-222222222222";

function space(key: string, overrides: Record<string, unknown> = {}) {
  return {
    id: SPACE_ID,
    mapId: MAP_ID,
    kind: "classroom",
    access: "normal",
    audioMode: "boundary",
    key,
    name: key,
    isMapDefault: false,
    capacity: null,
    audibleRadius: null,
    subscribeRadius: null,
    hysteresisFactor: "1.20",
    retiredAt: null,
    createdAt: "2026-11-01T09:00:00.000Z",
    updatedAt: "2026-11-01T09:00:00.000Z",
    ...overrides,
  };
}

function errorBody(code: string, details?: Record<string, unknown>) {
  return { error: { code, message: "Refused", ...(details && { details }) } };
}

const syncResult = {
  dryRun: true,
  changed: true,
  maps: [
    {
      outcome: "updated",
      key: "campus",
      version: "d686dbad05445e71",
      isEntry: true,
      spaces: {
        added: [{ key: "library", name: "Library", kind: "classroom" }],
        restored: ["studio"],
        retired: ["old-lab"],
        needsKind: ["room_space_1"],
      },
      desks: { added: ["desk_a1"], restored: [], retired: ["desk_b4"] },
    },
  ],
};

function campusMap(key: string, overrides: Record<string, unknown> = {}) {
  return {
    id: MAP_ID,
    key,
    name: "Campus",
    isEntry: false,
    retiredAt: null,
    syncedVersion: "version-2",
    syncedAt: "2026-11-24T10:00:00.000Z",
    publishedAt: "2026-11-24T10:05:00.000Z",
    publishedVersion: "version-1",
    ...overrides,
  };
}

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("readEntryMap", () => {
  it("takes the live entry map, never a retired one", async () => {
    mockApi.server.use(
      http.get(`${API_ORIGIN}/v1/maps`, () =>
        HttpResponse.json([
          campusMap("old-campus", {
            id: SPACE_ID,
            isEntry: true,
            retiredAt: "2026-10-01T09:00:00.000Z",
          }),
          campusMap("annex"),
          campusMap("campus", { isEntry: true }),
        ]),
      ),
    );

    expect(await readEntryMap(api)).toEqual({
      kind: "loaded",
      map: {
        id: MAP_ID,
        key: "campus",
        name: "Campus",
        syncedVersion: "version-2",
        publishedVersion: "version-1",
      },
    });
  });

  it("holds no entry map before anything is synced", async () => {
    mockApi.server.use(
      http.get(`${API_ORIGIN}/v1/maps`, () =>
        HttpResponse.json([campusMap("annex")]),
      ),
    );

    expect(await readEntryMap(api)).toEqual({ kind: "loaded", map: null });
  });

  it("reads versions no sync has recorded yet as null", async () => {
    mockApi.server.use(
      http.get(`${API_ORIGIN}/v1/maps`, () =>
        HttpResponse.json([
          campusMap("campus", {
            isEntry: true,
            syncedVersion: null,
            syncedAt: null,
            publishedVersion: null,
          }),
        ]),
      ),
    );

    expect(await readEntryMap(api)).toMatchObject({
      map: { syncedVersion: null, publishedVersion: null },
    });
  });

  it.each([
    ["an answer that does not parse", () => HttpResponse.json({ maps: [] })],
    [
      "a refusal",
      () => HttpResponse.json(errorBody("FORBIDDEN"), { status: 403 }),
    ],
    ["a network failure", () => HttpResponse.error()],
  ])("is unavailable on %s", async (_label, reply) => {
    mockApi.server.use(http.get(`${API_ORIGIN}/v1/maps`, reply));

    expect(await readEntryMap(api)).toEqual({ kind: "unavailable" });
  });
});

describe("listSpaces", () => {
  it("reads every page and keeps only the fields the page uses", async () => {
    mockApi.server.use(
      http.get(`${API_ORIGIN}/v1/spaces`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        return HttpResponse.json({
          items: [space(`room-${page}`)],
          meta: { page, perPage: 100, total: 2, totalPages: 2 },
        });
      }),
    );

    const read = await listSpaces(api, MAP_ID);

    expect(read).toEqual({
      kind: "loaded",
      spaces: [
        expect.objectContaining({ key: "room-1" }),
        expect.objectContaining({ key: "room-2" }),
      ],
    });
    expect(read.kind === "loaded" && read.spaces[0]).not.toHaveProperty(
      "hysteresisFactor",
    );
    expect(mockApi.requests).toHaveLength(2);
    expect(
      mockApi.requests.map(({ url }) => new URL(url).searchParams.get("mapId")),
    ).toEqual([MAP_ID, MAP_ID]);
  });

  it("is unavailable when a page does not parse", async () => {
    mockApi.server.use(
      http.get(`${API_ORIGIN}/v1/spaces`, () =>
        HttpResponse.json({
          items: [space("library", { kind: "ballroom" })],
          meta: { page: 1, perPage: 100, total: 1, totalPages: 1 },
        }),
      ),
    );

    expect(await listSpaces(api, MAP_ID)).toEqual({ kind: "unavailable" });
  });

  it("stops at its page cap instead of following a runaway total", async () => {
    mockApi.server.use(
      http.get(`${API_ORIGIN}/v1/spaces`, () =>
        HttpResponse.json({
          items: [space("library")],
          meta: { page: 1, perPage: 100, total: 1e6, totalPages: 10_000 },
        }),
      ),
    );

    expect(await listSpaces(api, MAP_ID)).toEqual({ kind: "unavailable" });
    expect(mockApi.requests).toHaveLength(20);
  });
});

describe("updateSpace", () => {
  it("sends only the fields it was given", async () => {
    let body: unknown;
    mockApi.server.use(
      http.patch(`${API_ORIGIN}/v1/spaces/${SPACE_ID}`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(space("library"));
      }),
    );

    const outcome = await updateSpace(api, SPACE_ID, {
      kind: "meeting_room",
      capacity: null,
    });

    expect(outcome).toEqual({ kind: "updated" });
    expect(body).toEqual({ kind: "meeting_room", capacity: null });
  });

  it.each([
    [400, "invalid"],
    [401, "signed-out"],
    [403, "forbidden"],
    [404, "missing"],
    [409, "kind-taken"],
    [500, "unavailable"],
  ])("answers %i as %s", async (status, problem) => {
    mockApi.server.use(
      http.patch(`${API_ORIGIN}/v1/spaces/${SPACE_ID}`, () =>
        HttpResponse.json(errorBody("CONFLICT"), { status }),
      ),
    );

    expect(await updateSpace(api, SPACE_ID, { name: "Library" })).toEqual({
      kind: "problem",
      problem,
    });
  });
});

describe("syncMaps", () => {
  it("asks for a dry run and keeps what the page reads", async () => {
    mockApi.server.use(
      http.post(`${API_ORIGIN}/v1/maps/sync`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("dryRun")).toBe("true");
        return HttpResponse.json(syncResult);
      }),
    );

    const outcome = await syncMaps(api, { dryRun: true });

    expect(outcome).toMatchObject({
      kind: "synced",
      result: { dryRun: true, changed: true },
    });
    expect(
      outcome.kind === "synced" && outcome.result.maps[0],
    ).not.toHaveProperty("version");
  });

  it("reads a 409 with problems as a rejection, and lists them", async () => {
    mockApi.server.use(
      http.post(`${API_ORIGIN}/v1/maps/sync`, () =>
        HttpResponse.json(
          errorBody("CONFLICT", {
            problems: ["campus: two spaces share the key library"],
          }),
          { status: 409 },
        ),
      ),
    );

    expect(await syncMaps(api, { dryRun: false })).toEqual({
      kind: "problem",
      problem: "rejected",
      mapProblems: ["campus: two spaces share the key library"],
    });
  });

  it("reads a 409 without problems as another sync running", async () => {
    mockApi.server.use(
      http.post(`${API_ORIGIN}/v1/maps/sync`, () =>
        HttpResponse.json(errorBody("CONFLICT"), { status: 409 }),
      ),
    );

    expect(await syncMaps(api, { dryRun: false })).toEqual({
      kind: "problem",
      problem: "busy",
      mapProblems: [],
    });
  });

  it.each([
    ["not_configured", "not-configured"],
    ["unreachable", "sanity-unreachable"],
    ["something_new", "unavailable"],
  ])("reads a 503 for %s as %s", async (reason, problem) => {
    mockApi.server.use(
      http.post(`${API_ORIGIN}/v1/maps/sync`, () =>
        HttpResponse.json(errorBody("SERVICE_UNAVAILABLE", { reason }), {
          status: 503,
        }),
      ),
    );

    expect(await syncMaps(api, { dryRun: true })).toMatchObject({ problem });
  });

  it("is unavailable when the result does not parse", async () => {
    mockApi.server.use(
      http.post(`${API_ORIGIN}/v1/maps/sync`, () =>
        HttpResponse.json({ dryRun: true }),
      ),
    );

    expect(await syncMaps(api, { dryRun: true })).toMatchObject({
      problem: "unavailable",
    });
  });
});

describe("publishMap", () => {
  it("publishes the map by id", async () => {
    mockApi.server.use(
      http.post(`${API_ORIGIN}/v1/maps/${MAP_ID}/publish`, () =>
        HttpResponse.json({
          publishedAt: "2026-11-23T12:00:00.000Z",
          id: MAP_ID,
          key: "campus",
        }),
      ),
    );

    expect(await publishMap(api, MAP_ID)).toEqual({ kind: "published" });
  });

  it.each([
    [400, "invalid"],
    [401, "signed-out"],
    [403, "forbidden"],
    [404, "missing"],
    [409, "refused"],
    [502, "unavailable"],
  ])("answers %i as %s", async (status, problem) => {
    mockApi.server.use(
      http.post(`${API_ORIGIN}/v1/maps/${MAP_ID}/publish`, () =>
        HttpResponse.json(errorBody("CONFLICT"), { status }),
      ),
    );

    expect(await publishMap(api, MAP_ID)).toEqual({
      kind: "problem",
      problem,
    });
  });
});
