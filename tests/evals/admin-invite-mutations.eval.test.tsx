import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { InviteActions } from "@/features/admin/invites/components/invite-actions";
import { toast, Toaster } from "@/shared/ui/toast";
import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const sideEffects = vi.hoisted(() => [] as string[]);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => sideEffects.push(`push ${href}`),
    refresh: () => sideEffects.push("refresh"),
  }),
}));
vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: (href: string) => sideEffects.push(`go ${href}`),
}));

const API = `${TEST_ORIGIN}/api/v1`;
const EMAIL = "ada@campus.local";
const RESEND_URL = `${API}/invites/invite-1/resend`;
const REVOKE_URL = `${API}/invites/invite-1/revoke`;

function failure(status: number, code: string) {
  return () => Response.json({ error: { code } }, { status });
}

function renderActions(
  status: "pending" | "expired" | "accepted" | "revoked" = "pending",
) {
  render(
    <>
      {withQueryClient(
        <InviteActions inviteId="invite-1" email={EMAIL} status={status} />,
      )}
      <Toaster />
    </>,
  );
}

function resendButton() {
  return screen.getByRole("button", { name: `Resend invite to ${EMAIL}` });
}

function revokeButton() {
  return screen.getByRole("button", { name: `Revoke invite to ${EMAIL}` });
}

function browserRequests() {
  return mockApi.requests.filter(({ url }) =>
    url.startsWith(`${TEST_ORIGIN}/api/`),
  );
}

afterEach(() => {
  cleanup();
  toast.close();
  mockApi.reset();
  sideEffects.length = 0;
});

afterAll(() => mockApi.close());

describe("Resend invite eval (threshold: 0 mismatched outcomes; exactly 1 request per double click)", () => {
  it("resends once and says so, then refreshes the page", async () => {
    mockApi.server.use(
      http.post(RESEND_URL, () => Response.json({ emailStatus: "sent" })),
    );
    renderActions();

    fireEvent.click(resendButton());
    fireEvent.click(resendButton());

    expect(await screen.findByText("Invite resent")).toBeVisible();
    expect(sideEffects).toEqual(["refresh"]);
    expect(browserRequests()).toHaveLength(1);
  });

  it.each(["failed", "disabled"])(
    "warns when the email status is %s, and shows no link",
    async (emailStatus) => {
      mockApi.server.use(
        http.post(RESEND_URL, () =>
          Response.json({
            emailStatus,
            inviteLink: "https://campus.example/invitation?token=secret",
          }),
        ),
      );
      renderActions();

      fireEvent.click(resendButton());

      expect(
        await screen.findByText("Invite renewed, but the email did not go out"),
      ).toBeVisible();
      expect(screen.queryByText(/token=secret/)).not.toBeInTheDocument();
    },
  );

  it.each([
    [
      409,
      "CONFLICT",
      "This address already has another pending invite, or has joined. Refresh the page.",
    ],
    [
      409,
      "INVITE_REVOKED",
      "This invite was answered or revoked. Refresh the page.",
    ],
    [
      409,
      "INVITE_ALREADY_ACCEPTED",
      "This invite was answered or revoked. Refresh the page.",
    ],
    [404, "NOT_FOUND", "This invite no longer exists. Refresh the page."],
    [403, "FORBIDDEN", "You no longer have permission to resend invites."],
    [
      400,
      "INVALID_ARGUMENT",
      "campus-api rejected this request. Refresh the page and try again.",
    ],
    [
      500,
      "INTERNAL_ERROR",
      "We couldn't resend this invite. Check your connection and try again.",
    ],
  ])("explains a %i %s", async (status, code, explanation) => {
    mockApi.server.use(http.post(RESEND_URL, failure(status, code)));
    renderActions("expired");

    fireEvent.click(resendButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(explanation);
    expect(sideEffects).toEqual([]);
    expect(browserRequests()).toHaveLength(1);
  });

  it("explains a network failure", async () => {
    mockApi.server.use(http.post(RESEND_URL, () => HttpResponse.error()));
    renderActions();

    fireEvent.click(resendButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't resend this invite.",
    );
  });

  it("goes to sign-in when the session has lapsed", async () => {
    mockApi.server.use(http.post(RESEND_URL, failure(401, "UNAUTHORIZED")));
    renderActions();

    fireEvent.click(resendButton());

    await waitFor(() => expect(sideEffects).toEqual(["go /sign-in"]));
  });
});

describe("Revoke invite eval (threshold: 0 mismatched outcomes; exactly 1 request per double click)", () => {
  it("revokes once and says so, then refreshes the page", async () => {
    mockApi.server.use(
      http.post(REVOKE_URL, () => Response.json({ status: "revoked" })),
    );
    renderActions();

    fireEvent.click(revokeButton());
    fireEvent.click(revokeButton());

    expect(await screen.findByText("Invite revoked")).toBeVisible();
    expect(sideEffects).toEqual(["refresh"]);
    expect(browserRequests()).toHaveLength(1);
  });

  it.each([
    [
      403,
      "INVITE_EXPIRED",
      "This invite has expired, so there is nothing to revoke.",
    ],
    [403, "FORBIDDEN", "You no longer have permission to revoke invites."],
    [
      409,
      "INVITE_REVOKED",
      "This invite was already answered or revoked. Refresh the page.",
    ],
    [404, "NOT_FOUND", "This invite no longer exists. Refresh the page."],
    [
      500,
      "INTERNAL_ERROR",
      "We couldn't revoke this invite. Nothing was changed. Check your connection and try again.",
    ],
  ])("explains a %i %s", async (status, code, explanation) => {
    mockApi.server.use(http.post(REVOKE_URL, failure(status, code)));
    renderActions();

    fireEvent.click(revokeButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(explanation);
    expect(sideEffects).toEqual([]);
    expect(browserRequests()).toHaveLength(1);
  });

  it("goes to sign-in when the session has lapsed", async () => {
    mockApi.server.use(http.post(REVOKE_URL, failure(401, "UNAUTHORIZED")));
    renderActions();

    fireEvent.click(revokeButton());

    await waitFor(() => expect(sideEffects).toEqual(["go /sign-in"]));
  });
});

describe("which actions an invite offers", () => {
  it("offers Resend and Revoke while pending, only Resend once expired, and neither once accepted or revoked", () => {
    renderActions("pending");
    expect(resendButton()).toBeVisible();
    expect(revokeButton()).toBeVisible();
    cleanup();

    renderActions("expired");
    expect(resendButton()).toBeVisible();
    expect(
      screen.queryByRole("button", { name: `Revoke invite to ${EMAIL}` }),
    ).not.toBeInTheDocument();
    cleanup();

    for (const settled of ["accepted", "revoked"] as const) {
      renderActions(settled);
      expect(
        screen.queryByRole("button", { name: /Resend|Revoke/ }),
      ).not.toBeInTheDocument();
      cleanup();
    }
  });
});
