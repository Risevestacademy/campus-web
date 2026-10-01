// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("API Route Handler lifecycle", () => {
  it("loads without build-time API configuration", async () => {
    vi.stubEnv("API_BASE_URL", "");

    await expect(import("./route")).resolves.toMatchObject({
      GET: expect.any(Function),
      POST: expect.any(Function),
    });
  });

  it("sanitizes missing runtime configuration", async () => {
    vi.stubEnv("API_BASE_URL", "");
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://frontend.example.test/api/v1/health", {
        headers: { origin: "https://frontend.example.test" },
      }),
      { params: Promise.resolve({ path: ["v1", "health"] }) },
    );
    const body = await response.text();

    expect(response.status).toBe(502);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(body).toContain('"code":"INTERNAL_ERROR"');
    expect(body).not.toContain("API_BASE_URL");
  });
});
