import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import type { ReactNode } from "react";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";
import { InvitationOffer, InviteConfirmation } from "@/features/invitation";
import { toast, Toaster } from "@/shared/ui/toast";
import {
  acceptedDecision,
  invitePreview,
  pendingInvite,
} from "@/tests/fixtures/invites";
import { type Reply, TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const navigations = vi.hoisted(() => [] as string[]);

vi.mock("@/core/analytics/client", () => ({
  captureBrowserAnalyticsEvent: () => {},
}));
vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: (href: string) => {
    navigations.push(href);
  },
}));

const API_ORIGIN = "https://api.example.test";
const PREVIEW_URL = `${API_ORIGIN}/v1/invites/preview`;
const VALIDATE_URL = `${API_ORIGIN}/v1/invites/validate-user-invite`;
const DECISION_URL = `${TEST_ORIGIN}/api/v1/invites/decision`;
const ACCEPT_FAILURE = "We couldn't accept your invitation";

const serverApi = createApiClient({ baseUrl: API_ORIGIN });

const json =
  (body: unknown, status = 200): Reply =>
  () =>
    Response.json(body, { status });
const failure = (status: number, code: string): Reply =>
  json({ error: { code, message: "scripted" } }, status);
const malformed: Reply = () =>
  new Response("<html>", { headers: { "content-type": "application/json" } });

interface BackendAnswer {
  name: string;
  reply: Reply;
  // What the visitor sees on a read (preview or validate), and after Accept.
  read: string;
  accept: string;
}

const EXPIRED = "alert: This invitation has expired";
const NOT_FOUND = "alert: We couldn't find this invitation";
const ACCEPTED = "alert: You've already accepted this invitation + Google";
const CLOSED = "alert: This invitation is no longer active";
const READ_OUTAGE = "alert: We couldn't load this invitation + retry";
const ACCEPT_OUTAGE = `toast: ${ACCEPT_FAILURE}`;

const FAILURES: BackendAnswer[] = [
  {
    name: "401",
    reply: failure(401, "UNAUTHORIZED"),
    read: "go /sign-in",
    accept: "go /sign-in",
  },
  {
    name: "403",
    reply: failure(403, "FORBIDDEN"),
    read: EXPIRED,
    accept: EXPIRED,
  },
  {
    name: "404",
    reply: failure(404, "NOT_FOUND"),
    read: NOT_FOUND,
    accept: NOT_FOUND,
  },
  {
    name: "409 accepted",
    reply: failure(409, "INVITE_ALREADY_ACCEPTED"),
    read: ACCEPTED,
    accept: ACCEPTED,
  },
  {
    name: "409 declined",
    reply: failure(409, "INVITE_ALREADY_DECLINED"),
    read: CLOSED,
    accept: CLOSED,
  },
  {
    name: "409 revoked",
    reply: failure(409, "INVITE_REVOKED"),
    read: CLOSED,
    accept: CLOSED,
  },
  {
    name: "409 standing membership",
    reply: failure(409, "CONFLICT"),
    read: "alert: You're already a member of this cohort",
    accept: "alert: You're already a member of this cohort",
  },
  {
    name: "429",
    reply: failure(429, "RATE_LIMITED"),
    read: READ_OUTAGE,
    accept: ACCEPT_OUTAGE,
  },
  {
    name: "500",
    reply: failure(500, "INTERNAL_ERROR"),
    read: READ_OUTAGE,
    accept: ACCEPT_OUTAGE,
  },
  {
    name: "502 proxy",
    reply: failure(502, "INTERNAL_ERROR"),
    read: READ_OUTAGE,
    accept: ACCEPT_OUTAGE,
  },
  {
    name: "malformed body",
    reply: malformed,
    read: READ_OUTAGE,
    accept: ACCEPT_OUTAGE,
  },
  {
    name: "network failure",
    reply: () => HttpResponse.error(),
    read: READ_OUTAGE,
    accept: ACCEPT_OUTAGE,
  },
];

// The toast is checked first: its live region may itself carry role="alert".
function describeScreen(): string {
  if (screen.queryAllByText(ACCEPT_FAILURE).length > 0) {
    return `toast: ${ACCEPT_FAILURE}`;
  }
  const [alert] = screen.queryAllByRole("alert");
  if (alert) {
    const title = alert.querySelector("h1, h2")?.textContent ?? "";
    const actions = [
      screen.queryByRole("link", { name: "Continue with Google" }) && "Google",
      screen.queryByRole("link", { name: "Try again" }) && "retry",
    ].filter(Boolean);
    return [`alert: ${title}`, ...actions].join(" + ");
  }
  return screen.getByRole("heading", { level: 1 }).textContent ?? "";
}

// A server render either returns markup or interrupts with a redirect.
async function observeRead(
  renderOnServer: () => Promise<ReactNode>,
): Promise<string> {
  try {
    render(withQueryClient(await renderOnServer()));
    return describeScreen();
  } catch (error) {
    if (isRedirectError(error)) return `go ${getURLFromRedirectError(error)}`;
    throw error;
  }
}

async function observeAccept(reply: Reply): Promise<string> {
  mockApi.server.use(
    http.get(VALIDATE_URL, json(pendingInvite())),
    http.post(DECISION_URL, reply),
  );
  render(
    <>
      {withQueryClient(await InviteConfirmation({ api: serverApi }))}
      <Toaster />
    </>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Go to Campus" }));
  await waitFor(() => {
    expect(
      navigations.length > 0 ||
        screen.queryAllByRole("alert").length > 0 ||
        screen.queryAllByText(ACCEPT_FAILURE).length > 0,
    ).toBe(true);
  });

  const seen =
    navigations.length > 0 ? `go ${navigations.join(",")}` : describeScreen();
  const posts = mockApi.requests.filter(({ url }) => url === DECISION_URL);
  return posts.length === 1 ? seen : `${seen} after ${posts.length} accepts`;
}

function settleRun() {
  toast.close();
  mockApi.reset();
  navigations.length = 0;
}

afterEach(settleRun);

afterAll(() => {
  mockApi.close();
});

interface Expectation {
  name: string;
  reply: Reply;
  expected: string;
}

async function collectMismatches(
  label: string,
  expectations: Expectation[],
  observe: (reply: Reply) => Promise<string>,
): Promise<string[]> {
  const mismatches: string[] = [];
  for (const { name, reply, expected } of expectations) {
    const seen = await observe(reply);
    if (seen !== expected) {
      mismatches.push(
        `${label} ${name}: expected "${expected}", got "${seen}"`,
      );
    }
    cleanup();
    settleRun();
  }
  return mismatches;
}

describe("Invitation eval (threshold: 0 mismatched outcomes, 0 automatic retries, 0 navigations on a failed accept)", () => {
  it("shows the right screen for every answer to the invite preview", async () => {
    const answers = [
      {
        name: "200",
        reply: json(invitePreview()),
        read: "You're invited to join Backend Engineering Cohort 2",
      },
      ...FAILURES,
    ];

    const mismatches = await collectMismatches(
      "preview",
      answers.map(({ name, reply, read }) => ({ name, reply, expected: read })),
      (reply) => {
        mockApi.server.use(http.post(PREVIEW_URL, reply));
        return observeRead(() =>
          InvitationOffer({ api: serverApi, token: "t" }),
        );
      },
    );

    expect(mismatches).toEqual([]);
  });

  it("shows the right screen for every answer to validate-user-invite", async () => {
    const answers = [
      {
        name: "200",
        reply: json(pendingInvite()),
        read: "Are your details correct?",
      },
      ...FAILURES,
    ];

    const mismatches = await collectMismatches(
      "validate",
      answers.map(({ name, reply, read }) => ({ name, reply, expected: read })),
      (reply) => {
        mockApi.server.use(http.get(VALIDATE_URL, reply));
        return observeRead(() => InviteConfirmation({ api: serverApi }));
      },
    );

    expect(mismatches).toEqual([]);
  });

  it("enters Campus only on an accepted answer, explains every other, and accepts once per click", async () => {
    const answers = [
      {
        name: "200 cohort",
        reply: json(acceptedDecision("c-1")),
        accept: "go /campus/c-1/join",
      },
      {
        name: "200 admin",
        reply: json(acceptedDecision(null)),
        accept: "go /campus",
      },
      ...FAILURES,
    ];

    const mismatches = await collectMismatches(
      "accept",
      answers.map(({ name, reply, accept }) => ({
        name,
        reply,
        expected: accept,
      })),
      observeAccept,
    );

    expect(mismatches).toEqual([]);
  });
});
