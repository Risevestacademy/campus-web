// @vitest-environment node

import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config, proxy } from "./proxy";

const ORIGIN = "https://campus.example.test";
const DEEP_LINK = "/campus/42?tab=people";
const ENCODED_DEEP_LINK = "%2Fcampus%2F42%3Ftab%3Dpeople";

interface Visit {
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}

function visit(path: string, { cookies = {}, headers = {} }: Visit = {}) {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return proxy(
    new NextRequest(new URL(path, ORIGIN), {
      headers: { ...headers, ...(cookie && { cookie }) },
    }),
  );
}

// Next hands NextResponse.next({ request: { headers } }) to the render as
// x-middleware-override-headers plus one x-middleware-request-<name> each.
function headersSeenByRender(response: NextResponse): Headers {
  const names =
    response.headers.get("x-middleware-override-headers")?.split(",") ?? [];
  return new Headers(
    names.map((name) => [
      name,
      response.headers.get(`x-middleware-request-${name}`) ?? "",
    ]),
  );
}

function markerDeletion(response: NextResponse): string | undefined {
  return response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith("campus_refresh_attempted="));
}

const backend = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", backend);
});

afterEach(() => {
  expect(backend).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  backend.mockReset();
});

describe("proxy matcher", () => {
  it.each(["/campus", "/campus/42", "/campus/42/meeting", "/campus/42/join"])(
    "runs for %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    },
  );

  it.each([
    "/",
    "/campusx",
    "/api/v1/auth/me",
    "/api/v1/auth/refresh",
    "/sign-in",
    "/session/refresh",
    "/invitation",
    "/preview",
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/favicon.ico",
  ])("does not run for %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});

describe("proxy: visitors without an access cookie", () => {
  it("sends them through one refresh, keeping their destination", () => {
    const response = visit(DEEP_LINK);

    expect(response.status).toBe(307);
    expect(getRedirectUrl(response)).toBe(
      `${ORIGIN}/session/refresh?returnTo=${ENCODED_DEEP_LINK}`,
    );
  });

  it("sends them to sign-in after their refresh attempt and clears the marker", () => {
    const response = visit(DEEP_LINK, {
      cookies: { campus_refresh_attempted: "1" },
    });

    expect(getRedirectUrl(response)).toBe(
      `${ORIGIN}/sign-in?returnTo=${ENCODED_DEEP_LINK}`,
    );
    expect(markerDeletion(response)).toMatch(
      /^campus_refresh_attempted=; Path=\/campus; Expires=Thu, 01 Jan 1970/,
    );
  });

  it("replaces an unsafe destination with the campus index", () => {
    const response = visit("/campus/a%2F..%2Fadmin");

    expect(getRedirectUrl(response)).toBe(
      `${ORIGIN}/session/refresh?returnTo=%2Fcampus`,
    );
  });
});

describe("proxy: visitors with an access cookie", () => {
  const signedIn = { campus_session: "session-token" };

  it("lets them through and tells the render where they were going", () => {
    const response = visit(DEEP_LINK, {
      cookies: signedIn,
      headers: { "x-forwarded-for": "198.51.100.7" },
    });
    const seen = headersSeenByRender(response);

    expect(getRedirectUrl(response)).toBeNull();
    expect(seen.get("x-campus-return-to")).toBe(DEEP_LINK);
    expect(seen.has("x-campus-refresh-attempted")).toBe(false);
    expect(seen.get("x-forwarded-for")).toBe("198.51.100.7");
    expect(markerDeletion(response)).toBeUndefined();
  });

  it("overwrites a return path the client tried to supply", () => {
    const response = visit(DEEP_LINK, {
      cookies: signedIn,
      headers: { "x-campus-return-to": "//attacker.example/campus" },
    });

    expect(headersSeenByRender(response).get("x-campus-return-to")).toBe(
      DEEP_LINK,
    );
  });

  it("strips a refresh signal the client tried to supply", () => {
    const response = visit(DEEP_LINK, {
      cookies: signedIn,
      headers: { "x-campus-refresh-attempted": "1" },
    });

    expect(
      headersSeenByRender(response).has("x-campus-refresh-attempted"),
    ).toBe(false);
  });

  it("forwards a completed refresh attempt to the render and clears the marker", () => {
    const response = visit(DEEP_LINK, {
      cookies: { ...signedIn, campus_refresh_attempted: "1" },
    });

    expect(getRedirectUrl(response)).toBeNull();
    expect(
      headersSeenByRender(response).get("x-campus-refresh-attempted"),
    ).toBe("1");
    expect(markerDeletion(response)).toMatch(
      /^campus_refresh_attempted=; Path=\/campus; Expires=Thu, 01 Jan 1970/,
    );
  });
});
