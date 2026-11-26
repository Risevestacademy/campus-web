// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client/create-api-client";

import { createRoomLink, readLinkableSpaces } from "./room-link-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const API_ORIGIN = "https://api.example.test";
const SPACES_URL = `${API_ORIGIN}/v1/spaces`;
const LINKS_URL = `${API_ORIGIN}/v1/cohorts/c-1/spaces/s-1/links`;
const api = () => createApiClient({ baseUrl: API_ORIGIN });

const space = (overrides: Record<string, unknown> = {}) => ({
  id: "s-1",
  mapId: "m-1",
  kind: "classroom",
  access: "normal",
  audioMode: "proximity",
  key: "pod-a",
  name: "Pod A",
  isMapDefault: false,
  capacity: null,
  ...overrides,
});

const page = (items: unknown[], pageNumber = 1, totalPages = 1) => ({
  items,
  meta: { page: pageNumber, perPage: 100, total: items.length, totalPages },
});

const link = (overrides: Record<string, unknown> = {}) => ({
  audience: "cohort",
  code: "k3F9xQ2pLm",
  url: "https://campus.example/join/k3F9xQ2pLm",
  title: "Design review",
  cohortId: "c-1",
  spaceId: "s-1",
  spaceKey: "pod-a",
  spaceName: "Pod A",
  cohortTrackId: null,
  mentorshipGroupId: null,
  startsAt: null,
  ...overrides,
});

afterEach(() => {
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("readLinkableSpaces", () => {
  it("lists the spaces that are set up, never the corridors", async () => {
    mockApi.server.use(
      http.get(SPACES_URL, () =>
        HttpResponse.json(
          page([
            space(),
            space({ id: "s-2", name: "Not set up", kind: null }),
            space({ id: "s-3", name: "Corridors", isMapDefault: true }),
          ]),
        ),
      ),
    );

    await expect(readLinkableSpaces(api())).resolves.toEqual({
      kind: "loaded",
      spaces: [{ id: "s-1", name: "Pod A" }],
    });
  });

  it("follows the pages", async () => {
    mockApi.server.use(
      http.get(SPACES_URL, ({ request }) => {
        const asked = Number(new URL(request.url).searchParams.get("page"));
        return HttpResponse.json(
          page([space({ id: `s-${asked}`, name: `Space ${asked}` })], asked, 2),
        );
      }),
    );

    const result = await readLinkableSpaces(api());

    expect(result).toEqual({
      kind: "loaded",
      spaces: [
        { id: "s-1", name: "Space 1" },
        { id: "s-2", name: "Space 2" },
      ],
    });
  });

  it("keeps nothing of a space beyond its id and name", async () => {
    mockApi.server.use(
      http.get(SPACES_URL, () =>
        HttpResponse.json(page([space({ capacity: 25, internalNote: "x" })])),
      ),
    );

    const result = await readLinkableSpaces(api());

    expect(JSON.stringify(result)).not.toMatch(/capacity|internalNote|pod-a/);
  });

  it.each([
    [401, { kind: "signed-out" }],
    [403, { kind: "forbidden" }],
    [503, { kind: "unavailable" }],
  ])("answers %i", async (status, expected) => {
    mockApi.server.use(
      http.get(SPACES_URL, () => new Response(null, { status })),
    );

    await expect(readLinkableSpaces(api())).resolves.toEqual(expected);
  });

  it("is unavailable after an answer it cannot read", async () => {
    mockApi.server.use(
      http.get(SPACES_URL, () => HttpResponse.json({ ok: true })),
    );

    await expect(readLinkableSpaces(api())).resolves.toEqual({
      kind: "unavailable",
    });
  });
});

describe("createRoomLink", () => {
  it("makes a link for the whole cohort and returns what the dialog shows", async () => {
    let body: unknown;
    mockApi.server.use(
      http.post(LINKS_URL, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(link(), { status: 201 });
      }),
    );

    const result = await createRoomLink(api(), "c-1", "s-1", "Design review");

    expect(body).toEqual({ title: "Design review", audience: "cohort" });
    expect(result).toEqual({
      kind: "created",
      link: {
        code: "k3F9xQ2pLm",
        url: "https://campus.example/join/k3F9xQ2pLm",
        title: "Design review",
        spaceName: "Pod A",
      },
    });
  });

  it.each([
    [400, "invalid"],
    [401, "signed-out"],
    [403, "forbidden"],
    [404, "space-unavailable"],
    [500, "unavailable"],
  ])("maps a %i to %s", async (status, problem) => {
    mockApi.server.use(
      http.post(LINKS_URL, () => new Response(null, { status })),
    );

    await expect(
      createRoomLink(api(), "c-1", "s-1", "Design review"),
    ).resolves.toEqual({ kind: "problem", problem });
  });

  it.each([
    [
      "an address for another code",
      { url: "https://x.example/join/AAAAAAAAAA" },
    ],
    ["a script address", { url: "javascript:alert(1)" }],
    ["a code of the wrong shape", { code: "short" }],
  ])("does not show %s", async (_, overrides) => {
    mockApi.server.use(
      http.post(LINKS_URL, () =>
        HttpResponse.json(link(overrides), { status: 201 }),
      ),
    );

    await expect(
      createRoomLink(api(), "c-1", "s-1", "Design review"),
    ).resolves.toEqual({ kind: "problem", problem: "unavailable" });
  });

  it("is unavailable after a network failure", async () => {
    mockApi.server.use(http.post(LINKS_URL, () => HttpResponse.error()));

    await expect(
      createRoomLink(api(), "c-1", "s-1", "Design review"),
    ).resolves.toEqual({ kind: "problem", problem: "unavailable" });
  });
});
