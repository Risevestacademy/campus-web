import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { withQueryClient } from "@/tests/fixtures/query-client";

import type { InvitesView } from "../services/invites-view.service";
import type { Invite, InvitesQuery } from "../types/invite.types";
import { InvitesAdministrationView } from "./invites-administration";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

const NOW = Date.parse("2026-10-10T12:00:00.000Z");
const DAY = 24 * 3_600_000;
const QUERY: InvitesQuery = { tab: "pending", page: 1 };

function invite(email: string, overrides: Partial<Invite> = {}): Invite {
  return {
    id: `id-${email}`,
    email,
    status: "pending",
    cohortRole: "student",
    expiresAt: new Date(NOW + DAY).toISOString(),
    revokedAt: null,
    createdAt: "2026-10-03T12:00:00.000Z",
    ...overrides,
  };
}

function view(invites: Invite[]): InvitesView {
  return {
    now: NOW,
    list: { kind: "loaded", invites, page: 1, totalPages: 1, total: 12 },
    counts: { pending: 12, accepted: 196, expired: 6, revoked: 1 },
    options: {
      tracks: {
        kind: "loaded",
        options: [{ id: "ct-1", name: "Backend", code: "BE" }],
      },
      groups: { kind: "loaded", options: [] },
    },
  };
}

function renderPage(invitesView: InvitesView, query: InvitesQuery = QUERY) {
  return render(
    withQueryClient(
      <InvitesAdministrationView
        cohortId="c-1"
        query={query}
        view={invitesView}
      />,
    ),
  );
}

describe("Invites page", () => {
  it("shows each status as a tab with its count, and marks the current one", () => {
    renderPage(view([invite("ada@campus.local")]));

    const tabs = within(
      screen.getByRole("navigation", { name: "Invite status" }),
    );
    expect(tabs.getByRole("link", { name: "Pending 12" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(tabs.getByRole("link", { name: "Accepted 196" })).toHaveAttribute(
      "href",
      "/campus/c-1/invites?status=accepted",
    );
    expect(tabs.getByRole("link", { name: "Expired 6" })).toBeVisible();
    expect(tabs.getByRole("link", { name: "Revoked 1" })).toBeVisible();
    expect(tabs.getAllByRole("link")).toHaveLength(4);
  });

  it("lists email, role, the date sent and when it expires", () => {
    renderPage(view([invite("ada@campus.local")]));

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Email", "Role", "Date sent", "Expires", "Actions"]);
    const row = within(screen.getByRole("row", { name: /ada@campus.local/ }));
    expect(row.getByText("3 Oct 2026")).toBeVisible();
    expect(row.getByText("Student")).toBeVisible();
    expect(row.getByText("1 day")).toBeVisible();
  });

  it("leaves out what the API does not send: placement, sender and a guest invite", () => {
    renderPage(view([invite("ada@campus.local")]));

    expect(
      screen.queryByRole("columnheader", { name: "Placement" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/by /)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /guest/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("offers Invite people and Bulk invite from the header", () => {
    renderPage(view([invite("ada@campus.local")]));

    expect(screen.getByRole("button", { name: "Invite people" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Bulk invite" })).toBeVisible();
  });

  it("offers Resend and Revoke on a pending invite", () => {
    renderPage(view([invite("ada@campus.local")]));

    expect(
      screen.getByRole("button", { name: "Resend invite to ada@campus.local" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Revoke invite to ada@campus.local" }),
    ).toBeVisible();
  });

  it("offers no actions on an accepted or revoked invite", () => {
    renderPage(
      view([
        invite("a@campus.local", { status: "accepted" }),
        invite("b@campus.local", { status: "revoked" }),
      ]),
      { tab: "accepted", page: 1 },
    );

    expect(
      screen.queryByRole("button", { name: /Resend|Revoke/ }),
    ).not.toBeInTheDocument();
  });

  it("says when a tab is empty and when the list cannot load", () => {
    const { rerender } = renderPage(view([]), { tab: "revoked", page: 1 });
    expect(screen.getByRole("alert")).toHaveTextContent("No revoked invites.");

    rerender(
      withQueryClient(
        <InvitesAdministrationView
          cohortId="c-1"
          query={QUERY}
          view={{ ...view([]), list: { kind: "unavailable" } }}
        />,
      ),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't load invites.",
    );
  });

  it("keeps the page usable when the counts could not be read", () => {
    renderPage({ ...view([invite("ada@campus.local")]), counts: {} });

    expect(screen.getByRole("link", { name: "Pending" })).toBeVisible();
  });
});
