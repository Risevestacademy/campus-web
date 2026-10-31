import { render, screen } from "@testing-library/react";
import { getAccessFallbackHTTPStatus } from "next/dist/client/components/http-access-fallback/http-access-fallback";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { Fragment, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ForgetPreviousMember } from "@/features/auth";
import { invitePreview } from "@/tests/fixtures/invites";

import InvitationPage from "./page";

const nextHeaders = vi.hoisted(() => ({ cookies: vi.fn(), headers: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: nextHeaders.cookies,
  headers: nextHeaders.headers,
}));
vi.mock("server-only", () => ({}));

const analytics = vi.hoisted(() => ({
  captureBrowserAnalyticsEvent: vi.fn(),
  resetIdentifiedAnalyticsUser: vi.fn(),
}));

vi.mock("@/core/analytics/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/core/analytics/client")>()),
  ...analytics,
}));

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

type PreviewPage = ReactElement<{ children: [ReactNode, ReactElement] }>;

async function previewPage(): Promise<PreviewPage> {
  const page = (await InvitationPage()) as PreviewPage;
  expect(page.type).toBe(Fragment);
  return page;
}

// The page returns an async server component, beside the analytics reset when
// it previews; run that component the way Next would.
async function visit(): Promise<ReactNode> {
  const page = (await InvitationPage()) as ReactElement;
  const element =
    page.type === Fragment ? (page as PreviewPage).props.children[1] : page;
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

const fullAccessSession = {
  ...invitedSession,
  scope: "full_access",
  inviteId: null,
};

const MISSING_LINK_HEADING = "Open your invitation link.";

beforeEach(() => {
  vi.stubEnv("API_BASE_URL", API_ORIGIN);
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
    backend(new Request(input, init)),
  );
  nextHeaders.headers.mockResolvedValue(
    new Headers({ "x-real-ip": "203.0.113.7" }),
  );
  withCookies({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  backend.mockReset();
  analytics.captureBrowserAnalyticsEvent.mockReset();
  analytics.resetIdentifiedAnalyticsUser.mockReset();
  nextHeaders.cookies.mockReset();
  nextHeaders.headers.mockReset();
});

describe("InvitationPage: an invite token cookie", () => {
  it("previews the invitation without asking for a session", async () => {
    withCookies({ campus_invite_token: TOKEN });
    backend.mockResolvedValue(Response.json(invitePreview()));

    render(await visit());

    expect(
      screen.getByRole("heading", {
        name: "You're invited to join Backend Engineering Cohort 2",
      }),
    ).toBeVisible();
    expect(calledPaths()).toEqual(["POST /v1/invites/preview"]);
  });

  it("sends the cookie's token to the preview", async () => {
    withCookies({ campus_invite_token: TOKEN });
    backend.mockResolvedValue(Response.json(invitePreview()));

    await visit();

    const request = backend.mock.calls[0]?.[0];
    await expect(request?.json()).resolves.toEqual({ token: TOKEN });
  });

  it("forgets a previous member for a signed-out visitor, without asking for a session", async () => {
    withCookies({ campus_invite_token: TOKEN });

    const [reset] = (await previewPage()).props.children;

    expect(reset).toEqual(<ForgetPreviousMember />);
    expect(backend).not.toHaveBeenCalled();
  });

  it("keeps the identity of a member still signed in", async () => {
    withCookies({
      campus_invite_token: TOKEN,
      campus_session: "session-token",
    });
    backend.mockResolvedValue(Response.json(invitedSession));

    const [reset] = (await previewPage()).props.children;

    expect(reset).toBe(false);
    expect(calledPaths()).toEqual(["GET /v1/auth/me"]);
  });

  it("forwards the visitor's address, which campus-api rate-limits by", async () => {
    withCookies({ campus_invite_token: TOKEN });
    backend.mockResolvedValue(Response.json(invitePreview()));

    await visit();

    const request = backend.mock.calls[0]?.[0];
    expect(request?.headers.get("x-forwarded-for")).toBe("203.0.113.7");
  });
});

describe("InvitationPage: no token", () => {
  it.each([
    { visitor: "an invitee", session: invitedSession, href: "/preview" },
    { visitor: "a member", session: fullAccessSession, href: "/campus" },
    {
      visitor: "a provisional session without an invite",
      session: { ...invitedSession, inviteId: null },
      href: "/sign-in?error=invite_required",
    },
  ])("sends $visitor on to $href", async ({ session, href }) => {
    withCookies({ campus_session: "session-token" });
    backend.mockImplementation(async () => Response.json(session));

    const interrupt = await visit().catch((error: unknown) => error);

    expect(isRedirectError(interrupt)).toBe(true);
    if (!isRedirectError(interrupt)) return;
    expect(getURLFromRedirectError(interrupt)).toBe(href);
    // React's cache memoizes the session read only inside a server request,
    // so outside one each caller reads it again.
    expect(new Set(calledPaths())).toEqual(new Set(["GET /v1/auth/me"]));
  });

  it.each<{
    visitor: string;
    cookies: Record<string, string>;
    reads: string[];
  }>([
    { visitor: "no cookies", cookies: {}, reads: [] },
    {
      visitor: "an empty token",
      cookies: { campus_invite_token: "" },
      reads: [],
    },
    {
      visitor: "a blank token",
      cookies: { campus_invite_token: "   " },
      reads: [],
    },
    {
      visitor: "an ended session",
      cookies: { campus_session: "session-token" },
      reads: ["GET /v1/auth/me"],
    },
  ])(
    "tells a signed-out visitor with $visitor how to continue",
    async ({ cookies, reads }) => {
      withCookies(cookies);
      backend.mockImplementation(
        async () => new Response(null, { status: 401 }),
      );

      render((await InvitationPage()) as ReactElement);

      expect(
        screen.getByRole("heading", { name: MISSING_LINK_HEADING }),
      ).toBeVisible();
      expect(
        screen.getByRole("link", { name: "Back to home" }),
      ).toHaveAttribute("href", "/");
      expect(screen.queryByRole("link", { name: /google/i })).toBeNull();
      expect(calledPaths()).toEqual(reads);
    },
  );

  it("forgets the previous member before counting the missing link", async () => {
    render((await InvitationPage()) as ReactElement);

    const { captureBrowserAnalyticsEvent, resetIdentifiedAnalyticsUser } =
      analytics;
    expect(captureBrowserAnalyticsEvent.mock.calls).toEqual([
      ["invitation.missing_link_shown", {}],
    ]);
    expect(
      resetIdentifiedAnalyticsUser.mock.invocationCallOrder[0],
    ).toBeLessThan(
      captureBrowserAnalyticsEvent.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("refuses an account the backend refuses", async () => {
    withCookies({ campus_session: "session-token" });
    backend.mockImplementation(async () => new Response(null, { status: 403 }));

    const interrupt = await visit().catch((error: unknown) => error);

    expect(getAccessFallbackHTTPStatus(interrupt as never)).toBe(403);
  });

  it("keeps the outage notice for a session that can't be read", async () => {
    withCookies({ campus_session: "session-token" });
    backend.mockImplementation(async () => new Response("not a session"));

    render(await visit());

    expect(
      screen.getByRole("heading", { name: "We couldn't check your session" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/invitation",
    );
    expect(
      screen.queryByRole("heading", { name: MISSING_LINK_HEADING }),
    ).toBeNull();
  });
});
