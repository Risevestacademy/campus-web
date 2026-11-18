// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import { readMemberProfile } from "./member-profile-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const CARD_URL = `${API_ORIGIN}/v1/users/:id/profile`;
const api = createApiClient({ baseUrl: API_ORIGIN });
const body = {
  id: "u-2",
  firstName: "Grace",
  lastName: "Hopper",
  displayName: "Grace H.",
  bio: null,
  avatarUrl: null,
  memberships: [],
};

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("member profile API adapter", () => {
  it("reads the card under the member's id", async () => {
    const asked = vi.fn();
    mockApi.server.use(
      http.get(CARD_URL, ({ params }) => {
        asked(params.id);
        return HttpResponse.json(body);
      }),
    );

    await expect(readMemberProfile(api, "u-2")).resolves.toStrictEqual({
      kind: "loaded",
      profile: body,
    });
    expect(asked).toHaveBeenCalledExactlyOnceWith("u-2");
  });

  it.each([404, 400])(
    "reads a %i as a card that is not there",
    async (status) => {
      mockApi.server.use(
        http.get(CARD_URL, () => new HttpResponse(null, { status })),
      );

      await expect(readMemberProfile(api, "u-2")).resolves.toStrictEqual({
        kind: "missing",
      });
    },
  );

  it("reads a 401 as signed out", async () => {
    mockApi.server.use(
      http.get(CARD_URL, () => new HttpResponse(null, { status: 401 })),
    );

    await expect(readMemberProfile(api, "u-2")).resolves.toStrictEqual({
      kind: "signed-out",
    });
  });

  it("reads a server error or a body it cannot use as unavailable", async () => {
    mockApi.server.use(
      http.get(CARD_URL, () => new HttpResponse(null, { status: 500 })),
    );
    await expect(readMemberProfile(api, "u-2")).resolves.toStrictEqual({
      kind: "unavailable",
    });

    mockApi.server.use(http.get(CARD_URL, () => HttpResponse.json({ id: 1 })));
    await expect(readMemberProfile(api, "u-2")).resolves.toStrictEqual({
      kind: "unavailable",
    });
  });

  it("reads a dropped connection as unavailable", async () => {
    mockApi.server.use(http.get(CARD_URL, () => HttpResponse.error()));

    await expect(readMemberProfile(api, "u-2")).resolves.toStrictEqual({
      kind: "unavailable",
    });
  });
});
