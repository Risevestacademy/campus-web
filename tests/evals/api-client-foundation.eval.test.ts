// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

function context(...path: string[]) {
  return { params: Promise.resolve({ path }) };
}

function requireSetCookie(response: Response, name: string): string {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${name}=`));

  if (!cookie) {
    throw new Error(`Expected ${name} in the response Set-Cookie headers.`);
  }

  return cookie;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("API client authentication journey eval", () => {
  it("keeps a full-access browser session usable through sign-in and logout", async () => {
    vi.stubEnv("API_BASE_URL", "https://api.example.test");

    vi.stubGlobal("fetch", (request: Request) => {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/v1/auth/google") {
        const headers = new Headers({
          location: "https://accounts.google.com/o/oauth2/v2/auth",
        });
        headers.append(
          "set-cookie",
          "campus_oauth_state=oauth-state; HttpOnly; Path=/v1/auth",
        );

        return Promise.resolve(new Response(null, { headers, status: 302 }));
      }

      if (
        request.method === "GET" &&
        url.pathname === "/v1/auth/google/callback"
      ) {
        expect(request.headers.get("cookie")).toBe(
          "campus_oauth_state=oauth-state",
        );

        const headers = new Headers({
          location: "http://localhost:3000/",
        });
        headers.append(
          "set-cookie",
          "campus_oauth_state=; Max-Age=0; HttpOnly; Path=/v1/auth",
        );
        headers.append(
          "set-cookie",
          "campus_session=session-token; HttpOnly; Path=/",
        );
        headers.append(
          "set-cookie",
          "campus_refresh=refresh-token; HttpOnly; Path=/v1/auth",
        );

        return Promise.resolve(new Response(null, { headers, status: 302 }));
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/logout") {
        expect(request.headers.get("cookie")).toBe(
          "campus_session=session-token; campus_refresh=refresh-token",
        );

        const headers = new Headers();
        headers.append(
          "set-cookie",
          "campus_session=; Max-Age=0; HttpOnly; Path=/",
        );
        headers.append(
          "set-cookie",
          "campus_refresh=; Max-Age=0; HttpOnly; Path=/v1/auth",
        );

        return Promise.resolve(new Response(null, { headers, status: 204 }));
      }

      throw new Error(`Unexpected upstream request: ${request.method} ${url}`);
    });

    const { GET, POST } = await import("../../app/api/[...path]/route");

    const startResponse = await GET(
      new Request(
        "http://localhost:3000/api/v1/auth/google?returnTo=%2Fcampus%2F42%2Fjoin",
      ),
      context("v1", "auth", "google"),
    );

    expect(startResponse.status).toBe(302);
    expect(startResponse.headers.get("location")).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(requireSetCookie(startResponse, "campus_oauth_state")).toBe(
      "campus_oauth_state=oauth-state; HttpOnly; SameSite=Lax; Path=/api/v1/auth",
    );
    expect(requireSetCookie(startResponse, "campus_oauth_return_to")).toBe(
      "campus_oauth_return_to=%2Fcampus%2F42%2Fjoin; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=600",
    );

    const callbackResponse = await GET(
      new Request(
        "http://localhost:3000/api/v1/auth/google/callback?code=google-code",
        {
          headers: {
            cookie:
              "campus_oauth_state=oauth-state; campus_oauth_return_to=%2Fcampus%2F42%2Fjoin",
          },
        },
      ),
      context("v1", "auth", "google", "callback"),
    );

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.get("location")).toBe(
      "http://localhost:3000/campus/42/join",
    );
    expect(requireSetCookie(callbackResponse, "campus_session")).toBe(
      "campus_session=session-token; HttpOnly; SameSite=Lax; Path=/",
    );
    expect(requireSetCookie(callbackResponse, "campus_refresh")).toBe(
      "campus_refresh=refresh-token; HttpOnly; SameSite=Lax; Path=/api/v1/auth",
    );
    expect(requireSetCookie(callbackResponse, "campus_oauth_return_to")).toBe(
      "campus_oauth_return_to=; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=0",
    );

    const logoutResponse = await POST(
      new Request("http://localhost:3000/api/v1/auth/logout", {
        headers: {
          cookie: "campus_session=session-token; campus_refresh=refresh-token",
          origin: "http://localhost:3000",
          "x-forwarded-host": "localhost:3000",
          "x-forwarded-proto": "http",
        },
        method: "POST",
      }),
      context("v1", "auth", "logout"),
    );

    expect(logoutResponse.status).toBe(204);
    expect(requireSetCookie(logoutResponse, "campus_session")).toBe(
      "campus_session=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/",
    );
    expect(requireSetCookie(logoutResponse, "campus_refresh")).toBe(
      "campus_refresh=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/api/v1/auth",
    );
  });
});
