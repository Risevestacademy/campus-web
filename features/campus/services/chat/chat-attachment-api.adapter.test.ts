// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import { attachToCall, readFileLink } from "./chat-attachment-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const COHORT = "c-1";
const SPACE = "7c2f0a64-93d1-4a52-a5d7-0b6c9f4c2e11";
const MEDIA = "9a0b8f10-1b64-4a3e-bf1a-2f5a58a0f4de";
const ATTACH_URL = `${API_ORIGIN}/v1/cohorts/${COHORT}/spaces/${SPACE}/call/attachments`;
const LINK_URL = `${API_ORIGIN}/v1/media/${MEDIA}/url`;
const api = createApiClient({ baseUrl: API_ORIGIN });
const attached = {
  id: MEDIA,
  fileName: "onboarding-flow.pdf",
  contentType: "application/pdf",
  sizeBytes: 1_234_567,
  url: "https://storage.example.test/signed?token=secret",
  urlExpiresAt: "2026-11-17T15:15:00.000Z",
};

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("attachToCall", () => {
  it("ties the upload to the call and answers the file as a chat line carries it", async () => {
    const bodies: unknown[] = [];
    mockApi.server.use(
      http.post(ATTACH_URL, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(attached, { status: 201 });
      }),
    );

    const result = await attachToCall(api, {
      cohortId: COHORT,
      mediaId: MEDIA,
      spaceId: SPACE,
    });

    expect(bodies).toEqual([{ mediaId: MEDIA }]);
    expect(result).toStrictEqual({
      kind: "attached",
      attachment: {
        mediaId: MEDIA,
        fileName: "onboarding-flow.pdf",
        contentType: "application/pdf",
        sizeBytes: 1_234_567,
      },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it.each([
    [401, "signed-out"],
    [403, "not-allowed"],
    [404, "not-sent"],
    [409, "no-call"],
    [422, "not-sent"],
    [503, "unavailable"],
    [500, "unavailable"],
  ])("answers a %s as %s", async (status, problem) => {
    mockApi.server.use(
      http.post(ATTACH_URL, () =>
        HttpResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status }),
      ),
    );

    await expect(
      attachToCall(api, { cohortId: COHORT, mediaId: MEDIA, spaceId: SPACE }),
    ).resolves.toStrictEqual({ kind: "problem", problem });
  });

  it("answers unavailable for a body it cannot read", async () => {
    mockApi.server.use(
      http.post(ATTACH_URL, () =>
        HttpResponse.json({ id: MEDIA, sizeBytes: -5 }, { status: 201 }),
      ),
    );

    await expect(
      attachToCall(api, { cohortId: COHORT, mediaId: MEDIA, spaceId: SPACE }),
    ).resolves.toStrictEqual({ kind: "problem", problem: "unavailable" });
  });

  it("answers unavailable when the connection drops", async () => {
    mockApi.server.use(http.post(ATTACH_URL, () => HttpResponse.error()));

    await expect(
      attachToCall(api, { cohortId: COHORT, mediaId: MEDIA, spaceId: SPACE }),
    ).resolves.toStrictEqual({ kind: "problem", problem: "unavailable" });
  });
});

describe("readFileLink", () => {
  it("answers the fresh link and nothing else about the file", async () => {
    mockApi.server.use(http.get(LINK_URL, () => HttpResponse.json(attached)));

    await expect(readFileLink(api, MEDIA)).resolves.toStrictEqual({
      kind: "link",
      url: attached.url,
    });
  });

  it("says a file let go when the call ended", async () => {
    mockApi.server.use(
      http.get(LINK_URL, () =>
        HttpResponse.json({ error: { code: "MEDIA_GONE" } }, { status: 410 }),
      ),
    );

    await expect(readFileLink(api, MEDIA)).resolves.toStrictEqual({
      kind: "problem",
      problem: "gone",
    });
  });

  it.each([
    [401, "signed-out"],
    [404, "not-found"],
    [503, "unavailable"],
  ])("answers a %s as %s", async (status, problem) => {
    mockApi.server.use(
      http.get(LINK_URL, () =>
        HttpResponse.json({ error: { code: "NOT_FOUND" } }, { status }),
      ),
    );

    await expect(readFileLink(api, MEDIA)).resolves.toStrictEqual({
      kind: "problem",
      problem,
    });
  });

  it.each([
    [
      "a link that is not https",
      { ...attached, url: "http://storage.example.test/x" },
    ],
    ["a link that is not an address", { ...attached, url: "not a link" }],
    ["no link", { id: MEDIA }],
  ])("refuses %s", async (_, body) => {
    mockApi.server.use(http.get(LINK_URL, () => HttpResponse.json(body)));

    await expect(readFileLink(api, MEDIA)).resolves.toStrictEqual({
      kind: "problem",
      problem: "unavailable",
    });
  });
});
