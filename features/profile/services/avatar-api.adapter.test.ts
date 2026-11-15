// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import { removeAvatar, setAvatar } from "./avatar-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const AVATAR_URL = `${API_ORIGIN}/v1/users/me/avatar`;
const api = createApiClient({ baseUrl: API_ORIGIN });
const profile = {
  id: "u-1",
  email: "ada@campus.local",
  firstName: "Ada",
  lastName: "Lovelace",
  displayName: "Ada L.",
  bio: null,
  phone: null,
  avatarUrl: "https://media.example.test/avatars/u-1/new.webp",
  memberships: [],
};

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("avatar API adapter", () => {
  it("sets the uploaded picture and answers the profile it leaves", async () => {
    const bodies: unknown[] = [];
    mockApi.server.use(
      http.put(AVATAR_URL, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(profile);
      }),
    );

    await expect(setAvatar(api, "m-1")).resolves.toStrictEqual({
      kind: "changed",
      profile,
    });
    expect(bodies).toStrictEqual([{ mediaId: "m-1" }]);
  });

  it.each([
    [404, "expired"],
    [422, "mismatch"],
    [401, "signed-out"],
    [400, "unavailable"],
    [503, "unavailable"],
  ])("reads a %i on setting as %s", async (status, problem) => {
    mockApi.server.use(
      http.put(AVATAR_URL, () => new HttpResponse(null, { status })),
    );

    await expect(setAvatar(api, "m-1")).resolves.toStrictEqual({
      kind: "problem",
      problem,
    });
  });

  it("removes the picture and answers the profile with none", async () => {
    mockApi.server.use(
      http.delete(AVATAR_URL, () =>
        HttpResponse.json({ ...profile, avatarUrl: null }),
      ),
    );

    await expect(removeAvatar(api)).resolves.toStrictEqual({
      kind: "changed",
      profile: { ...profile, avatarUrl: null },
    });
  });

  it("reads a dropped connection as unavailable", async () => {
    mockApi.server.use(http.delete(AVATAR_URL, () => HttpResponse.error()));

    await expect(removeAvatar(api)).resolves.toStrictEqual({
      kind: "problem",
      problem: "unavailable",
    });
  });
});
