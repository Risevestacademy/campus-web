// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import {
  endMembership,
  extendGuestVisit,
  moveMemberTrack,
} from "./membership-actions.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const MEMBER_URL = `${API_ORIGIN}/v1/cohorts/c-1/members/u-1`;
const api = createApiClient({ baseUrl: API_ORIGIN });
const MEMBERSHIP = { cohortId: "c-1", userId: "u-1" };

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("membership actions adapter", () => {
  it.each(["graduate", "defer", "withdraw", "dismiss", "remove"] as const)(
    "posts a %s to its own endpoint",
    async (end) => {
      const bodies: unknown[] = [];
      mockApi.server.use(
        http.post(`${MEMBER_URL}/${end}`, async ({ request }) => {
          bodies.push(await request.json());
          return Response.json({});
        }),
      );

      expect(
        await endMembership(api, end, MEMBERSHIP, { reason: "Because" }),
      ).toEqual({ kind: "ended" });
      expect(bodies).toEqual([{ reason: "Because" }]);
    },
  );

  it("sends an empty body when there is no reason", async () => {
    const bodies: unknown[] = [];
    mockApi.server.use(
      http.post(`${MEMBER_URL}/withdraw`, async ({ request }) => {
        bodies.push(await request.json());
        return Response.json({});
      }),
    );

    await endMembership(api, "withdraw", MEMBERSHIP, { reason: undefined });

    expect(bodies).toEqual([{}]);
  });

  it.each([
    [400, "invalid", "invalid", "invalid"],
    [401, "signed-out", "signed-out", "signed-out"],
    [403, "forbidden", "forbidden", "forbidden"],
    [404, "missing", "missing", "missing"],
    [409, "not-endable", "not-movable", "visit-ended"],
    [500, "unavailable", "unavailable", "unavailable"],
  ] as const)(
    "reads a %i as its problem",
    async (status, end, move, extend) => {
      mockApi.server.use(
        http.post(
          `${MEMBER_URL}/graduate`,
          () => new HttpResponse(null, { status }),
        ),
        http.patch(
          `${MEMBER_URL}/track`,
          () => new HttpResponse(null, { status }),
        ),
        http.patch(MEMBER_URL, () => new HttpResponse(null, { status })),
      );

      expect(
        await endMembership(api, "graduate", MEMBERSHIP, { reason: undefined }),
      ).toEqual({ kind: "problem", problem: end });
      expect(
        await moveMemberTrack(api, MEMBERSHIP, { trackId: "t-2" }),
      ).toEqual({ kind: "problem", problem: move });
      expect(
        await extendGuestVisit(api, MEMBERSHIP, {
          accessExpiresAt: "2026-12-05T12:00:00.000Z",
        }),
      ).toEqual({ kind: "problem", problem: extend });
    },
  );

  it("moves a track and extends a visit with only the new value", async () => {
    const bodies: unknown[] = [];
    mockApi.server.use(
      http.patch(`${MEMBER_URL}/track`, async ({ request }) => {
        bodies.push(await request.json());
        return Response.json({});
      }),
      http.patch(MEMBER_URL, async ({ request }) => {
        bodies.push(await request.json());
        return Response.json({});
      }),
    );

    expect(await moveMemberTrack(api, MEMBERSHIP, { trackId: "t-2" })).toEqual({
      kind: "moved",
    });
    expect(
      await extendGuestVisit(api, MEMBERSHIP, {
        accessExpiresAt: "2026-12-05T12:00:00.000Z",
      }),
    ).toEqual({ kind: "extended" });
    expect(bodies).toEqual([
      { trackId: "t-2" },
      { accessExpiresAt: "2026-12-05T12:00:00.000Z" },
    ]);
  });

  it("is unavailable when the request never arrives", async () => {
    mockApi.server.use(
      http.post(`${MEMBER_URL}/remove`, () => HttpResponse.error()),
    );

    expect(
      await endMembership(api, "remove", MEMBERSHIP, { reason: undefined }),
    ).toEqual({ kind: "problem", problem: "unavailable" });
  });
});
