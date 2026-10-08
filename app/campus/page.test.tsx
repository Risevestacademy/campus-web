import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CampusPage from "./page";

const routeAccess = vi.hoisted(() => ({
  requireRouteAccess: vi.fn(),
}));
const administratorTransport = vi.hoisted(() => ({
  getServerApi: vi.fn(),
}));

vi.mock("@/core/api/client/server", () => ({
  getServerApi: administratorTransport.getServerApi,
}));
vi.mock("@/features/admin", () => ({
  AdministrationCatalogue: () => (
    <nav aria-label="Campus catalogues">Administration</nav>
  ),
}));
vi.mock("@/features/auth", () => ({
  AccountMenu: ({ children }: { children: ReactNode }) => children,
  isSystemAdministrator: (role: string) =>
    role === "admin" || role === "super_admin",
  requireRouteAccess: routeAccess.requireRouteAccess,
  SessionUnavailable: () => null,
}));
vi.mock("server-only", () => ({}));

const memberSession = {
  scope: "full_access",
  expiresAt: "2099-01-01T00:15:00.000Z",
  inviteId: null,
  user: {
    id: "user-1",
    displayName: "Ada",
    email: "ada@campus.local",
    systemRole: "user",
  },
  memberships: [
    {
      cohortId: "cohort-3",
      cohort: { name: "Cohort 3", code: "C3" },
    },
    {
      cohortId: "cohort-4",
      cohort: { name: "Cohort 4", code: "C4" },
    },
  ],
} as const;

beforeEach(() => {
  routeAccess.requireRouteAccess.mockResolvedValue({
    kind: "allow",
    session: memberSession,
  });
  administratorTransport.getServerApi.mockRejectedValue(
    new Error("Administrator transport must not be constructed for a member."),
  );
});

afterEach(() => {
  routeAccess.requireRouteAccess.mockReset();
  administratorTransport.getServerApi.mockReset();
});

describe("CampusPage", () => {
  it("renders member Cohorts without constructing the administrator transport", async () => {
    render(await CampusPage({ searchParams: Promise.resolve({ page: "3" }) }));

    expect(screen.getByRole("link", { name: /Cohort 3/ })).toHaveAttribute(
      "href",
      "/campus/cohort-3",
    );
    expect(administratorTransport.getServerApi).not.toHaveBeenCalled();
  });

  it("renders the administration catalogue for a Super Administrator", async () => {
    routeAccess.requireRouteAccess.mockResolvedValue({
      kind: "allow",
      session: {
        ...memberSession,
        user: { ...memberSession.user, systemRole: "super_admin" },
        memberships: [],
      },
    });

    render(await CampusPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("navigation", { name: "Campus catalogues" }),
    ).toBeInTheDocument();
  });
});
