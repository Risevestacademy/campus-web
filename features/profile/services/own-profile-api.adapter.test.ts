// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import { readOwnProfile, saveOwnProfile } from "./own-profile-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const ME_URL = `${API_ORIGIN}/v1/users/me`;
const api = createApiClient({ baseUrl: API_ORIGIN });
const body = {
  id: "u-1",
  email: "ada@campus.local",
  firstName: "Ada",
  lastName: "Lovelace",
  displayName: "Ada L.",
  bio: null,
  phone: null,
  avatarUrl: null,
  memberships: [],
};

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("own profile API adapter", () => {
  it("reads the member's own profile", async () => {
    mockApi.server.use(http.get(ME_URL, () => HttpResponse.json(body)));

    await expect(readOwnProfile(api)).resolves.toStrictEqual({
      kind: "loaded",
      profile: body,
    });
  });

  it.each([
    [401, "signed-out"],
    [500, "unavailable"],
  ])("reads a %i as %s", async (status, kind) => {
    mockApi.server.use(
      http.get(ME_URL, () => new HttpResponse(null, { status })),
    );

    await expect(readOwnProfile(api)).resolves.toStrictEqual({ kind });
  });

  it("reads a body it cannot use as unavailable", async () => {
    mockApi.server.use(http.get(ME_URL, () => HttpResponse.json({})));

    await expect(readOwnProfile(api)).resolves.toStrictEqual({
      kind: "unavailable",
    });
  });

  it("sends only the changes and returns the saved profile", async () => {
    mockApi.server.use(
      http.patch(ME_URL, async ({ request }) => {
        expect(await request.json()).toStrictEqual({ displayName: "Ada" });
        return HttpResponse.json({ ...body, displayName: "Ada" });
      }),
    );

    await expect(
      saveOwnProfile(api, { displayName: "Ada" }),
    ).resolves.toStrictEqual({
      kind: "saved",
      profile: { ...body, displayName: "Ada" },
    });
  });

  it.each([
    [400, "invalid"],
    [401, "signed-out"],
    [503, "unavailable"],
  ])("reads a refused save's %i as %s", async (status, problem) => {
    mockApi.server.use(
      http.patch(ME_URL, () => new HttpResponse(null, { status })),
    );

    await expect(saveOwnProfile(api, { bio: "Hi" })).resolves.toStrictEqual({
      kind: "problem",
      problem,
    });
  });
});
