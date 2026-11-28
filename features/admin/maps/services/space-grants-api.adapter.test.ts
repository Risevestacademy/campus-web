// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import {
  endSpaceGrant,
  grantSpaceAccess,
  listSpaceGrants,
} from "./space-grants-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const api = createApiClient({ baseUrl: API_ORIGIN });
const SPACE_ID = "55555555-5555-4555-8555-555555555555";
const GRANT_ID = "66666666-6666-4666-8666-666666666666";
const GRANTS_URL = `${API_ORIGIN}/v1/spaces/${SPACE_ID}/memberships`;

function grant(subject: Record<string, unknown>, live = true) {
  return {
    id: GRANT_ID,
    spaceId: SPACE_ID,
    subject,
    grantedBy: null,
    validFrom: "2026-11-01T09:00:00.000Z",
    validTo: live ? null : "2026-11-02T09:00:00.000Z",
    live,
  };
}

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("listSpaceGrants", () => {
  it("keeps what names each subject", async () => {
    mockApi.server.use(
      http.get(GRANTS_URL, () =>
        HttpResponse.json([
          grant({
            type: "user",
            userId: "u-1",
            email: "ada@campus.local",
            displayName: "Ada L.",
          }),
          grant(
            {
              type: "cohort_track",
              cohortTrackId: "ct-1",
              trackName: "Frontend",
              trackCode: "FE",
              cohortId: "c-1",
              cohortName: "Cohort 1",
            },
            false,
          ),
        ]),
      ),
    );

    expect(await listSpaceGrants(api, SPACE_ID)).toEqual({
      kind: "loaded",
      grants: [
        {
          id: GRANT_ID,
          live: true,
          subject: {
            type: "user",
            email: "ada@campus.local",
            displayName: "Ada L.",
          },
        },
        {
          id: GRANT_ID,
          live: false,
          subject: { type: "cohort_track", trackName: "Frontend" },
        },
      ],
    });
  });

  it("is unavailable when the answer does not parse", async () => {
    mockApi.server.use(
      http.get(GRANTS_URL, () => HttpResponse.json([grant({ type: "pet" })])),
    );

    expect(await listSpaceGrants(api, SPACE_ID)).toEqual({
      kind: "unavailable",
    });
  });
});

describe("grantSpaceAccess", () => {
  it.each([
    [{ type: "user", userId: "u-1" }, { userId: "u-1" }],
    [
      { type: "cohort_track", cohortTrackId: "ct-1" },
      { cohortTrackId: "ct-1" },
    ],
    [
      { type: "mentorship_group", mentorshipGroupId: "g-1" },
      { mentorshipGroupId: "g-1" },
    ],
    [{ type: "cohort_role", cohortRole: "mentor" }, { cohortRole: "mentor" }],
  ] as const)("names exactly one subject for %o", async (target, body) => {
    let sent: unknown;
    mockApi.server.use(
      http.post(GRANTS_URL, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(grant({ type: target.type }), { status: 201 });
      }),
    );

    expect(await grantSpaceAccess(api, SPACE_ID, target)).toEqual({
      kind: "granted",
    });
    expect(sent).toEqual(body);
  });

  it.each([
    [400, "invalid"],
    [401, "signed-out"],
    [403, "forbidden"],
    [404, "missing"],
    [409, "conflict"],
    [500, "unavailable"],
  ] as const)("reads %i as %s", async (status, problem) => {
    mockApi.server.use(
      http.post(GRANTS_URL, () =>
        HttpResponse.json({ error: { code: "X", message: "x" } }, { status }),
      ),
    );

    expect(
      await grantSpaceAccess(api, SPACE_ID, { type: "user", userId: "u-1" }),
    ).toEqual({ kind: "problem", problem });
  });
});

describe("endSpaceGrant", () => {
  it("ends the grant by its own id", async () => {
    mockApi.server.use(
      http.delete(
        `${GRANTS_URL}/${GRANT_ID}`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    expect(await endSpaceGrant(api, SPACE_ID, GRANT_ID)).toEqual({
      kind: "ended",
    });
  });

  it("reads a 409 as already ended", async () => {
    mockApi.server.use(
      http.delete(`${GRANTS_URL}/${GRANT_ID}`, () =>
        HttpResponse.json(
          { error: { code: "CONFLICT", message: "x" } },
          { status: 409 },
        ),
      ),
    );

    expect(await endSpaceGrant(api, SPACE_ID, GRANT_ID)).toEqual({
      kind: "problem",
      problem: "already-ended",
    });
  });
});
