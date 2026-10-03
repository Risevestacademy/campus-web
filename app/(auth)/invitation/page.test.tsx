import { render, screen } from "@testing-library/react";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { invitePreview } from "@/tests/fixtures/invites";

import InvitationPage from "./page";

const nextHeaders = vi.hoisted(() => ({ cookies: vi.fn(), headers: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: nextHeaders.cookies,
  headers: nextHeaders.headers,
}));
vi.mock("server-only", () => ({}));

const TOKEN = "zHrjwba-bzFiiuyT5wb1OiuUQUdS619_DNNd0C6sFg0";
const API_ORIGIN = "https://api.example.test";

const backend = vi.fn<(request: Request) => Promise<Response>>();

function withCookies(values: Record<string, string>) {
  nextHeaders.cookies.mockResolvedValue({
    get: (name: string) =>
      values[name] === undefined ? undefined : { name, value: values[name] },
    has: (name: string) => values[name] !== undefined,
  });
}

// The page returns an async server component; run it the way Next would.
async function visit(query: { token?: string | string[] }): Promise<ReactNode> {
  const element = (await InvitationPage({
    searchParams: Promise.resolve(query),
  })) as ReactElement;
  const component = element.type as (props: unknown) => Promise<ReactNode>;
  return component(element.props);
}

function calledPaths(): string[] {
  return backend.mock.calls.map(
    ([request]) => `${request.method} ${new URL(request.url).pathname}`,
  );
}

const invitedSession = {
  scope: "provisional",
  expiresAt: "2099-01-01T00:15:00.000Z",
  inviteId: "invite-1",
  user: { id: "user-1", email: "ada@campus.local", systemRole: "user" },
  memberships: [],
};

beforeEach(() => {
  vi.stubEnv("API_BASE_URL", API_ORIGIN);
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
    backend(new Request(input, init)),
  );
  nextHeaders.headers.mockResolvedValue(
    new Headers({ "x-forwarded-for": "203.0.113.7" }),
  );
  withCookies({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  backend.mockReset();
  nextHeaders.cookies.mockReset();
  nextHeaders.headers.mockReset();
});

describe("InvitationPage: an invite link", () => {
  it("previews the invitation without asking for a session", async () => {
    backend.mockResolvedValue(Response.json(invitePreview()));

    render(await visit({ token: TOKEN }));

    expect(
      screen.getByRole("heading", {
        name: "You're invited to join Backend Engineering Cohort 2",
      }),
    ).toBeVisible();
    expect(calledPaths()).toEqual(["POST /v1/invites/preview"]);
  });

  it("forwards the visitor's address, which campus-api rate-limits by", async () => {
    backend.mockResolvedValue(Response.json(invitePreview()));

    await visit({ token: TOKEN });

    const request = backend.mock.calls[0]?.[0];
    expect(request?.headers.get("x-forwarded-for")).toBe("203.0.113.7");
  });
});

describe("InvitationPage: no token", () => {
  it("sends a signed-in invitee on to the preview", async () => {
    withCookies({ campus_session: "session-token" });
    backend.mockResolvedValue(Response.json(invitedSession));

    const interrupt = await visit({}).catch((error: unknown) => error);

    expect(isRedirectError(interrupt)).toBe(true);
    if (!isRedirectError(interrupt)) return;
    expect(getURLFromRedirectError(interrupt)).toBe("/preview");
    expect(calledPaths()).toEqual(["GET /v1/auth/me"]);
  });

  it.each([{}, { token: "" }])(
    "sends a visitor with neither a token nor a session through refresh (%o)",
    async (query) => {
      const interrupt = await visit(query).catch((error: unknown) => error);

      expect(isRedirectError(interrupt)).toBe(true);
      if (!isRedirectError(interrupt)) return;
      expect(getURLFromRedirectError(interrupt)).toBe(
        "/session/refresh?returnTo=%2Finvitation",
      );
      expect(backend).not.toHaveBeenCalled();
    },
  );
});
