// @vitest-environment node

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { moveInviteTokenToCookie } from "./invite-token-proxy.service";

const TOKEN = "zHrjwba-bzFiiuyT5wb1OiuUQUdS619_DNNd0C6sFg0";

function visit(path: string, origin = "https://campus.example.test") {
  return moveInviteTokenToCookie(new NextRequest(new URL(path, origin)));
}

function inviteCookie(response: Response): string | undefined {
  return response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith("campus_invite_token="));
}

describe("moveInviteTokenToCookie", () => {
  it("moves the token into an HttpOnly cookie and redirects to the clean page", () => {
    const response = visit(`/invitation?token=${TOKEN}`);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://campus.example.test/invitation",
    );
    const cookie = inviteCookie(response);
    expect(cookie).toContain(`campus_invite_token=${TOKEN}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\/invitation/i);
    expect(cookie).toMatch(/Max-Age=1800/i);
  });

  it("drops every other query parameter with the token", () => {
    const response = visit(`/invitation?token=${TOKEN}&utm_source=email`);

    expect(response.headers.get("location")).toBe(
      "https://campus.example.test/invitation",
    );
  });

  it("keeps the cookie usable on plain-HTTP local development", () => {
    const response = visit(
      `/invitation?token=${TOKEN}`,
      "http://localhost:3000",
    );

    expect(inviteCookie(response)).not.toMatch(/Secure/i);
  });

  it.each([
    ["an empty token", "/invitation?token="],
    ["a blank token", "/invitation?token=%20%20"],
    ["an oversized token", `/invitation?token=${"a".repeat(513)}`],
  ])("still cleans the URL for %s, clearing any earlier invite", (_, path) => {
    const response = visit(path);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://campus.example.test/invitation",
    );
    expect(inviteCookie(response)).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  it("lets a visit without a token through untouched", () => {
    const response = visit("/invitation");

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(inviteCookie(response)).toBeUndefined();
  });
});
