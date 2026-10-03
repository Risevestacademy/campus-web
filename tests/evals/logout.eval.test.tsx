import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { AccountMenu } from "@/features/auth";
import { toast, Toaster } from "@/shared/ui/toast";
import { type Reply, TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const observed = vi.hoisted(() => ({
  captured: [] as string[],
  reset: 0,
  replaced: [] as string[],
}));

vi.mock("@/core/analytics/client", () => ({
  captureBrowserAnalyticsEvent: (name: string) => {
    observed.captured.push(name);
  },
  resetAnalyticsUser: () => {
    observed.reset += 1;
  },
}));
vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: (href: string) => {
    observed.replaced.push(href);
  },
}));
vi.mock("server-only", () => ({}));

const FAILURE_MESSAGE = "We couldn't log you out";

interface Outcome {
  backend: string;
  reply: Reply;
  loggedOut: boolean;
}

const status =
  (code: number): Reply =>
  () =>
    new Response(null, { status: code });

const OUTCOMES: Outcome[] = [
  { backend: "204 No Content", reply: status(204), loggedOut: true },
  { backend: "401 already signed out", reply: status(401), loggedOut: true },
  { backend: "500", reply: status(500), loggedOut: false },
  { backend: "503", reply: status(503), loggedOut: false },
  {
    backend: "network failure",
    reply: () => HttpResponse.error(),
    loggedOut: false,
  },
];

// What a visitor and the analytics pipeline see after one Log out click.
async function logOutAgainst(reply: Reply): Promise<string> {
  observed.captured = [];
  observed.reset = 0;
  observed.replaced = [];
  mockApi.server.use(
    http.post(`${TEST_ORIGIN}/api/v1/auth/logout`, reply, { once: true }),
  );
  const view = render(
    <>
      {withQueryClient(
        <AccountMenu>
          <span>A</span>
        </AccountMenu>,
      )}
      <Toaster />
    </>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Account" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Log out" }));
  await waitFor(() => {
    expect(
      observed.replaced.length + screen.queryAllByText(FAILURE_MESSAGE).length,
    ).toBeGreaterThan(0);
  });

  const seen = [
    `navigated=${observed.replaced.join(",") || "no"}`,
    `told=${screen.queryAllByText(FAILURE_MESSAGE).length > 0}`,
    `captured=${observed.captured.join(",") || "nothing"}`,
    `reset=${observed.reset}`,
  ].join(" ");
  view.unmount();
  toast.close();
  return seen;
}

function expectedFor({ loggedOut }: Outcome): string {
  return loggedOut
    ? "navigated=/sign-in told=false captured=auth.logout reset=1"
    : "navigated=no told=true captured=nothing reset=0";
}

afterEach(() => {
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("Logout eval (threshold: 0 mismatched outcomes, 0 sign-in navigations with a live session)", () => {
  it("leaves for sign-in only when the session has ended, and explains every failure", async () => {
    const mismatches: string[] = [];

    for (const outcome of OUTCOMES) {
      const seen = await logOutAgainst(outcome.reply);
      const expected = expectedFor(outcome);
      if (seen !== expected) {
        mismatches.push(
          `${outcome.backend}: expected "${expected}", got "${seen}"`,
        );
      }
    }

    expect(mismatches).toEqual([]);
  });
});
