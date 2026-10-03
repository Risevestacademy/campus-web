import { render, screen } from "@testing-library/react";
import {
  getRedirectStatusCodeFromError,
  getURLFromRedirectError,
} from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignInPage from "./page";

const browserCookies = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: browserCookies,
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("server-only", () => ({}));

const backend = vi.fn<typeof fetch>();

function withCookies(values: Record<string, string>) {
  browserCookies.mockResolvedValue({
    get: (name: string) =>
      values[name] === undefined ? undefined : { name, value: values[name] },
    has: (name: string) => values[name] !== undefined,
  });
}

function visit(query: { error?: string; returnTo?: string }) {
  return SignInPage({ searchParams: Promise.resolve(query) });
}

async function renderVisit(query: { error?: string; returnTo?: string }) {
  render(await visit(query));
}

function googleLink() {
  return screen.getByRole("link", { name: "Continue with Google" });
}

beforeEach(() => {
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
  vi.stubGlobal("fetch", backend);
  withCookies({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  backend.mockReset();
  browserCookies.mockReset();
});

describe("SignInPage: anonymous visitors", () => {
  it("renders sign-in without asking the backend about a session", async () => {
    await renderVisit({});

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(backend).not.toHaveBeenCalled();
  });

  it.each(["/campus/42/join", "/invitation"])(
    "starts Google OAuth with the safe destination %s",
    async (returnTo) => {
      await renderVisit({ returnTo });

      expect(googleLink()).toHaveAttribute(
        "href",
        `/api/v1/auth/google?${new URLSearchParams({ returnTo }).toString()}`,
      );
    },
  );

  it.each(["//attacker.example/campus", "/sign-in"])(
    "starts Google OAuth without the unsafe destination %s",
    async (returnTo) => {
      await renderVisit({ returnTo });

      expect(googleLink()).toHaveAttribute("href", "/api/v1/auth/google");
    },
  );
});

describe("SignInPage: signed-in visitors", () => {
  it("redirects a full-access session to its destination before rendering", async () => {
    withCookies({ campus_session: "session-token" });
    backend.mockResolvedValue(
      Response.json({
        scope: "full_access",
        expiresAt: "2099-01-01T00:15:00.000Z",
        inviteId: null,
        user: { id: "user-1", email: "ada@campus.local", systemRole: "user" },
        memberships: [],
      }),
    );

    const interrupt = await visit({ returnTo: "/campus/42/join" }).catch(
      (error: unknown) => error,
    );

    expect(isRedirectError(interrupt)).toBe(true);
    if (!isRedirectError(interrupt)) return;
    expect(getURLFromRedirectError(interrupt)).toBe("/campus/42/join");
    expect(getRedirectStatusCodeFromError(interrupt)).toBe(307);
  });
});

describe("SignInPage: error messages", () => {
  it("shows a safe message for a known backend error", async () => {
    await renderVisit({ error: "denied" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Google sign-in was cancelled.",
    );
  });

  it("explains a missing invitation", async () => {
    await renderVisit({ error: "invite_required" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "You need an invitation to access Campus.",
    );
  });

  it("does not expose an unknown backend error value", async () => {
    await renderVisit({ error: "private-backend-detail" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sign-in could not be completed. Please try again.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "private-backend-detail",
    );
  });

  it("shows no alert without an error", async () => {
    await renderVisit({ returnTo: "/invitation" });

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
