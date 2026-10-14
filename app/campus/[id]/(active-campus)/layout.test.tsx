import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRouteAccess } from "@/features/auth";

import ActiveCampusLayout from "./layout";

vi.mock("@/features/admin", () => ({ AdminSidebar: () => null }));
vi.mock("@/features/auth", () => ({
  AccountMenu: () => null,
  isSystemAdministrator: () => false,
  logsOutFromRail: () => true,
  requireRouteAccess: vi.fn(),
  SessionUnavailable: () => <p>Session unavailable</p>,
}));
vi.mock("@/features/campus", () => ({
  ActiveCampus: ({ children }: { children: ReactNode }) => children,
  PresenceSessionGate: ({
    children,
    cohortId,
  }: {
    children: ReactNode;
    cohortId: string;
  }) => <section aria-label={`Admission ${cohortId}`}>{children}</section>,
  CampusShell: ({ children }: { children: ReactNode }) => children,
  SidebarCollapseButton: () => null,
}));
vi.mock("@/features/roster", () => ({ CampusOverviewPanel: () => null }));
vi.mock("server-only", () => ({}));

const params = Promise.resolve({ id: "c-1" });

describe("ActiveCampusLayout", () => {
  beforeEach(() => {
    vi.mocked(requireRouteAccess).mockReset();
  });

  it("checks authorization before rendering the admission boundary", async () => {
    vi.mocked(requireRouteAccess).mockResolvedValue({
      kind: "unavailable",
      retryHref: "/campus/c-1",
    });

    render(
      await ActiveCampusLayout({
        children: <p>Campus content</p>,
        params,
      }),
    );

    expect(screen.getByText("Session unavailable")).toBeVisible();
    expect(screen.queryByLabelText("Admission c-1")).not.toBeInTheDocument();
  });

  it("wraps authorized active-campus content in the admission boundary", async () => {
    vi.mocked(requireRouteAccess).mockResolvedValue({
      kind: "allow",
      session: {
        expiresAt: "2026-10-11T23:00:00.000Z",
        inviteId: null,
        memberships: [],
        scope: "full_access",
        user: {
          displayName: "Ada Lovelace",
          email: "ada@campus.local",
          systemRole: "user",
        },
      },
    });

    render(
      await ActiveCampusLayout({
        children: <p>Campus content</p>,
        params,
      }),
    );

    expect(screen.getByLabelText("Admission c-1")).toContainElement(
      screen.getByText("Campus content"),
    );
  });
});
