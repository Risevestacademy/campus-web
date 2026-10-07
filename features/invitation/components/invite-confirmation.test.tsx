import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createApiClient } from "@/core/api/client";
import { toast, Toaster } from "@/shared/ui/toast";
import { acceptedDecision, pendingInvite } from "@/tests/fixtures/invites";
import { inOrder, type Reply, TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

import { InviteConfirmation } from "../index";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const sideEffects = vi.hoisted(() => [] as string[]);

vi.mock("@/core/analytics/client", () => ({
  captureBrowserAnalyticsEvent: (name: string, properties: object) => {
    sideEffects.push(`capture ${name} ${JSON.stringify(properties)}`);
  },
}));
vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: (href: string) => {
    sideEffects.push(`replace document ${href}`);
  },
}));

const API_ORIGIN = "https://api.example.test";
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
const neverAnswers: Reply = () => new Promise<Response>(() => {});

function pendingInviteReplies(reply: Reply) {
  mockApi.server.use(http.get(VALIDATE_URL, reply));
}

function decisionReplies(...replies: Reply[]) {
  mockApi.server.use(http.post(DECISION_URL, inOrder(...replies)));
}

const decisionPosts = () =>
  mockApi.requests.filter(({ url }) => url === DECISION_URL);

async function renderConfirmation() {
  render(
    <>
      {withQueryClient(await InviteConfirmation({ api: serverApi }))}
      <Toaster />
    </>,
  );
}

function goToCampus() {
  fireEvent.click(screen.getByRole("button", { name: "Go to Campus" }));
}

function details() {
  return screen
    .getAllByRole("term")
    .map((term) => `${term.textContent}: ${term.nextSibling?.textContent}`);
}

beforeEach(() => {
  sideEffects.length = 0;
});

afterEach(() => {
  toast.close();
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("InviteConfirmation: details", () => {
  it("shows the signed-in invitee's details from the pending invite", async () => {
    pendingInviteReplies(json(pendingInvite()));

    await renderConfirmation();

    expect(
      screen.getByRole("heading", { name: "Are your details correct?" }),
    ).toBeVisible();
    expect(details()).toEqual([
      "Name: Ada Lovelace",
      "Email: ada@campus.local",
      "Role: Student",
      "Cohort: Backend Engineering Cohort 2",
    ]);
  });

  it("shows the full name when Google's display name is the first name alone", async () => {
    pendingInviteReplies(
      json(
        pendingInvite({
          user: { ...pendingInvite().user, displayName: "Ada" },
        }),
      ),
    );

    await renderConfirmation();

    expect(details()[0]).toBe("Name: Ada Lovelace");
  });

  it("falls back to the display name when the invite has no name parts", async () => {
    pendingInviteReplies(
      json(
        pendingInvite({
          user: {
            ...pendingInvite().user,
            firstName: null,
            lastName: null,
            displayName: "Ada L.",
          },
        }),
      ),
    );

    await renderConfirmation();

    expect(details()[0]).toBe("Name: Ada L.");
  });

  it("shows the cohort alone for a role without a track", async () => {
    pendingInviteReplies(
      json(pendingInvite({ track: null, cohortRole: "mentor" })),
    );

    await renderConfirmation();

    expect(details().slice(2)).toEqual(["Role: Mentor", "Cohort: Cohort 2"]);
  });

  it("leaves out the name and cohort when an admin invite has neither", async () => {
    pendingInviteReplies(
      json(
        pendingInvite({
          cohort: null,
          cohortRole: null,
          systemRole: "admin",
          user: {
            ...pendingInvite().user,
            displayName: null,
            firstName: null,
            lastName: null,
          },
        }),
      ),
    );

    await renderConfirmation();

    expect(details()).toEqual(["Email: ada@campus.local", "Role: Admin"]);
  });
});

// Each failure's screen is covered by the invitation eval; these cover the
// interaction itself.
describe("InviteConfirmation: accepting", () => {
  beforeEach(() => {
    pendingInviteReplies(json(pendingInvite()));
  });

  it("accepts through the browser proxy, records it, then loads the cohort entry", async () => {
    decisionReplies(json(acceptedDecision("c-1")));
    await renderConfirmation();

    goToCampus();

    await waitFor(() => {
      expect(sideEffects).toEqual([
        'capture auth.verification_completed {"verification_type":"invite"}',
        "replace document /campus/c-1",
      ]);
    });
    expect(decisionPosts()).toHaveLength(1);
  });

  it("disables the button while the accept is in flight", async () => {
    decisionReplies(neverAnswers);
    await renderConfirmation();

    goToCampus();

    expect(
      await screen.findByRole("button", { name: "Joining Campus…" }),
    ).toBeDisabled();
  });

  it("keeps the button disabled after accepting, so the invite is never accepted twice", async () => {
    decisionReplies(json(acceptedDecision("c-1")));
    await renderConfirmation();

    goToCampus();

    await waitFor(() => {
      expect(sideEffects).toContain("replace document /campus/c-1");
    });
    expect(
      screen.getByRole("button", { name: "Joining Campus…" }),
    ).toBeDisabled();
  });

  it.each([
    ["a server error", failure(503, "INTERNAL_ERROR")],
    ["a network failure", () => HttpResponse.error()],
  ])(
    "explains %s, keeps the visitor here, and lets them try again by hand",
    async (_, reply) => {
      decisionReplies(reply, json(acceptedDecision("c-1")));
      await renderConfirmation();

      goToCampus();

      expect(await screen.findByText(ACCEPT_FAILURE)).toBeInTheDocument();
      expect(decisionPosts()).toHaveLength(1);
      expect(sideEffects).toEqual([]);

      goToCampus();

      await waitFor(() => {
        expect(sideEffects).toContain("replace document /campus/c-1");
      });
      expect(decisionPosts()).toHaveLength(2);
    },
  );
});
