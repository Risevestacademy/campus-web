// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import type { PutFile } from "./types";
import { uploadMedia } from "./upload-media";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const api = createApiClient({ baseUrl: API_ORIGIN });
const STORAGE_URL = "https://storage.example.test/holding/m-1?signature=abc";
const limits = {
  maxAttachments: 10,
  kinds: [
    {
      kind: "avatar",
      contentTypes: ["image/jpeg", "image/webp"],
      maxBytes: 2_000_000,
    },
    { kind: "something_new", contentTypes: ["*/*"], maxBytes: 1 },
  ],
};
const signed = {
  method: "PUT",
  mediaId: "m-1",
  uploadUrl: STORAGE_URL,
  headers: { "Content-Type": "image/webp" },
  expiresAt: "2026-11-14T12:10:00.000Z",
};
const picture = new Blob(["picture"], { type: "image/webp" });

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

function answerLimits(reply: () => Response = () => HttpResponse.json(limits)) {
  mockApi.server.use(http.get(`${API_ORIGIN}/v1/uploads/limits`, reply));
}

function answerSigning(
  reply: () => Response = () => HttpResponse.json(signed, { status: 201 }),
) {
  const bodies: unknown[] = [];
  mockApi.server.use(
    http.post(`${API_ORIGIN}/v1/uploads`, async ({ request }) => {
      bodies.push(await request.json());
      return reply();
    }),
  );
  return bodies;
}

const stored: PutFile = async () => ({ kind: "answered", status: 200 });

describe("uploadMedia", () => {
  it("checks the limits, signs the file and sends it with the signed headers", async () => {
    answerLimits();
    const bodies = answerSigning();
    const put = vi.fn<PutFile>(stored);

    await expect(
      uploadMedia({ api, kind: "avatar", file: picture, put }),
    ).resolves.toStrictEqual({ kind: "uploaded", mediaId: "m-1" });
    expect(bodies).toStrictEqual([
      { kind: "avatar", contentType: "image/webp", sizeBytes: picture.size },
    ]);
    expect(put).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        url: STORAGE_URL,
        headers: { "Content-Type": "image/webp" },
        file: picture,
      }),
    );
  });

  it("names the file when it is given one", async () => {
    answerLimits();
    const bodies = answerSigning();

    await uploadMedia({
      api,
      kind: "avatar",
      file: picture,
      fileName: "me.webp",
      put: stored,
    });

    expect(bodies[0]).toMatchObject({ fileName: "me.webp" });
  });

  it("refuses a type the kind does not take before asking to sign it", async () => {
    answerLimits();
    const bodies = answerSigning();

    await expect(
      uploadMedia({
        api,
        kind: "avatar",
        file: new Blob(["gif"], { type: "image/gif" }),
        put: stored,
      }),
    ).resolves.toStrictEqual({
      kind: "problem",
      problem: {
        kind: "type-not-allowed",
        allowed: ["image/jpeg", "image/webp"],
      },
    });
    expect(bodies).toHaveLength(0);
  });

  it("refuses a file over the limit before asking to sign it", async () => {
    answerLimits(() =>
      HttpResponse.json({
        ...limits,
        kinds: [{ ...limits.kinds[0], maxBytes: 3 }],
      }),
    );
    const bodies = answerSigning();

    await expect(
      uploadMedia({ api, kind: "avatar", file: picture, put: stored }),
    ).resolves.toStrictEqual({
      kind: "problem",
      problem: { kind: "too-large", maxBytes: 3 },
    });
    expect(bodies).toHaveLength(0);
  });

  it("reads a 401 on the limits as signed out", async () => {
    answerLimits(() => new HttpResponse(null, { status: 401 }));

    await expect(
      uploadMedia({ api, kind: "avatar", file: picture, put: stored }),
    ).resolves.toStrictEqual({
      kind: "problem",
      problem: { kind: "signed-out" },
    });
  });

  it.each([
    [
      413,
      { error: { code: "UPLOAD_TOO_LARGE", details: { maxBytes: 1_000_000 } } },
      { kind: "too-large", maxBytes: 1_000_000 },
    ],
    [
      415,
      {
        error: {
          code: "UPLOAD_TYPE_NOT_ALLOWED",
          details: { allowed: ["image/png"] },
        },
      },
      { kind: "type-not-allowed", allowed: ["image/png"] },
    ],
    [429, { error: { code: "RATE_LIMITED" } }, { kind: "rate-limited" }],
    [401, { error: { code: "UNAUTHORIZED" } }, { kind: "signed-out" }],
    [503, { error: { code: "SERVICE_UNAVAILABLE" } }, { kind: "unavailable" }],
  ])("reads a %i from signing", async (status, body, problem) => {
    answerLimits();
    answerSigning(() => HttpResponse.json(body, { status }));

    await expect(
      uploadMedia({ api, kind: "avatar", file: picture, put: stored }),
    ).resolves.toStrictEqual({ kind: "problem", problem });
  });

  it("sends nothing to a storage address that is not https", async () => {
    answerLimits();
    answerSigning(() =>
      HttpResponse.json(
        { ...signed, uploadUrl: "http://storage.example.test/m-1" },
        { status: 201 },
      ),
    );
    const put = vi.fn<PutFile>(stored);

    await expect(
      uploadMedia({ api, kind: "avatar", file: picture, put }),
    ).resolves.toStrictEqual({
      kind: "problem",
      problem: { kind: "unavailable" },
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("signs again once when storage says the URL expired", async () => {
    answerLimits();
    const bodies = answerSigning();
    const put = vi
      .fn<PutFile>()
      .mockResolvedValueOnce({ kind: "answered", status: 403 })
      .mockResolvedValueOnce({ kind: "answered", status: 200 });

    await expect(
      uploadMedia({ api, kind: "avatar", file: picture, put }),
    ).resolves.toStrictEqual({ kind: "uploaded", mediaId: "m-1" });
    expect(bodies).toHaveLength(2);
    expect(put).toHaveBeenCalledTimes(2);
  });

  it("gives up after a second expired URL", async () => {
    answerLimits();
    const bodies = answerSigning();
    const put = vi.fn<PutFile>(async () => ({
      kind: "answered",
      status: 403,
    }));

    await expect(
      uploadMedia({ api, kind: "avatar", file: picture, put }),
    ).resolves.toStrictEqual({
      kind: "problem",
      problem: { kind: "unavailable" },
    });
    expect(bodies).toHaveLength(2);
  });

  it("reads any other storage failure as unavailable, without retrying", async () => {
    answerLimits();
    const bodies = answerSigning();

    await expect(
      uploadMedia({
        api,
        kind: "avatar",
        file: picture,
        put: async () => ({ kind: "failed" }),
      }),
    ).resolves.toStrictEqual({
      kind: "problem",
      problem: { kind: "unavailable" },
    });
    expect(bodies).toHaveLength(1);
  });

  it("reads a cancelled upload as cancelled", async () => {
    answerLimits();
    answerSigning();
    const controller = new AbortController();

    await expect(
      uploadMedia({
        api,
        kind: "avatar",
        file: picture,
        signal: controller.signal,
        put: async () => {
          controller.abort();
          return { kind: "aborted" };
        },
      }),
    ).resolves.toStrictEqual({
      kind: "problem",
      problem: { kind: "cancelled" },
    });
  });
});
