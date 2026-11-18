import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { putFile } from "./put-file";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const STORAGE_URL = "https://storage.example.test/holding/m-1";

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("putFile", () => {
  it("PUTs with the given headers and answers the status", async () => {
    const received = vi.fn();
    mockApi.server.use(
      // jsdom's XMLHttpRequest does not hand a Blob body to the interceptor,
      // so only the headers can be checked here.
      http.put(STORAGE_URL, ({ request }) => {
        received(request.headers.get("content-type"));
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await expect(
      putFile({
        url: STORAGE_URL,
        headers: { "Content-Type": "image/webp" },
        file: new Blob(["picture"], { type: "image/webp" }),
      }),
    ).resolves.toStrictEqual({ kind: "answered", status: 200 });
    expect(received).toHaveBeenCalledExactlyOnceWith("image/webp");
  });

  it("answers a refusal's status", async () => {
    mockApi.server.use(
      http.put(STORAGE_URL, () => new HttpResponse(null, { status: 403 })),
    );

    await expect(
      putFile({ url: STORAGE_URL, headers: {}, file: new Blob(["x"]) }),
    ).resolves.toStrictEqual({ kind: "answered", status: 403 });
  });

  it("sends nothing once cancelled", async () => {
    const received = vi.fn();
    mockApi.server.use(
      http.put(STORAGE_URL, () => {
        received();
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const controller = new AbortController();
    controller.abort();

    await expect(
      putFile({
        url: STORAGE_URL,
        headers: {},
        file: new Blob(["x"]),
        signal: controller.signal,
      }),
    ).resolves.toStrictEqual({ kind: "aborted" });
    expect(received).not.toHaveBeenCalled();
  });
});
