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

describe("API Route Handler OAuth return destinations", () => {
  const upstreamRequests: Request[] = [];

  function backendRedirectsTo(location: string) {
    vi.stubGlobal("fetch", (request: Request) => {
      upstreamRequests.push(request);
      return Promise.resolve(
        new Response(null, { headers: { location }, status: 302 }),
      );
    });
  }

  async function loadRoute() {
    vi.stubEnv("API_BASE_URL", "https://api.example.test");
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    return import("./route");
  }

  afterEach(() => {
    upstreamRequests.length = 0;
    vi.restoreAllMocks();
  });

  it("remembers a nested Campus deep link without forwarding it upstream", async () => {
    backendRedirectsTo("https://accounts.google.com/o/oauth2/v2/auth");
    const { GET } = await loadRoute();
    const search = new URLSearchParams({ returnTo: "/campus/42/rooms?seat=3" });

    const response = await GET(
      new Request(
        `https://frontend.example.test/api/v1/auth/google?${search.toString()}`,
      ),
      { params: Promise.resolve({ path: ["v1", "auth", "google"] }) },
    );

    expect(upstreamRequests[0]?.url).toBe(
      "https://api.example.test/v1/auth/google",
    );
    expect(response.headers.getSetCookie()).toContain(
      "campus_oauth_return_to=%2Fcampus%2F42%2Frooms%3Fseat%3D3; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=600",
    );
  });

  it("restores the nested Campus deep link after a successful callback", async () => {
    backendRedirectsTo("https://frontend.example.test/");
    const { GET } = await loadRoute();

    const response = await GET(
      new Request(
        "https://frontend.example.test/api/v1/auth/google/callback?code=google-code",
        {
          headers: {
            cookie:
              "campus_oauth_state=oauth-state; campus_oauth_return_to=%2Fcampus%2F42%2Frooms%3Fseat%3D3",
          },
        },
      ),
      {
        params: Promise.resolve({ path: ["v1", "auth", "google", "callback"] }),
      },
    );

    expect(response.headers.get("location")).toBe(
      "https://frontend.example.test/campus/42/rooms?seat=3",
    );
  });

  it("refuses an off-site return destination", async () => {
    backendRedirectsTo("https://accounts.google.com/o/oauth2/v2/auth");
    const { GET } = await loadRoute();
    const search = new URLSearchParams({
      returnTo: "//attacker.example/campus",
    });

    const response = await GET(
      new Request(
        `https://frontend.example.test/api/v1/auth/google?${search.toString()}`,
      ),
      { params: Promise.resolve({ path: ["v1", "auth", "google"] }) },
    );

    expect(response.headers.getSetCookie()).toContain(
      "campus_oauth_return_to=; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=0",
    );
  });
});
