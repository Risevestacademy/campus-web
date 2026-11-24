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
vi.mock("@/features/calendar", async () => {
  const actual = await vi.importActual<typeof import("@/features/calendar")>(
    "@/features/calendar",
  );
  return {
    ...actual,
    CalendarOutcomeNotice: ({ outcome }: { outcome: string }) => (
      <p role="status">Calendar outcome: {outcome}</p>
    ),
  };
});
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
      "/campus/cohort-3/join",
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
  describe("coming back from connecting Google Calendar", () => {
    function destinationAskedFor(): ((cohortId: string) => string) | undefined {
      const [request] = routeAccess.requireRouteAccess.mock.calls[0] as [
        { destination?: (cohortId: string) => string },
      ];
      return request.destination;
    }

    it("asks for a member with one cohort to land on that cohort's calendar, with the outcome", async () => {
      await CampusPage({
        searchParams: Promise.resolve({ calendar: "connected" }),
      });

      expect(destinationAskedFor()?.("cohort-3")).toBe(
        "/campus/cohort-3/calendar?calendar=connected",
      );
    });

    it("asks for nothing special on an ordinary visit", async () => {
      await CampusPage({ searchParams: Promise.resolve({}) });

      expect(destinationAskedFor()).toBeUndefined();
    });

    it("says the outcome here when there is more than one cohort to choose from", async () => {
      render(
        await CampusPage({
          searchParams: Promise.resolve({ calendar: "denied" }),
        }),
      );

      expect(screen.getByRole("status")).toHaveTextContent(
        "Calendar outcome: denied",
      );
      expect(screen.getByRole("link", { name: /Cohort 3/ })).toBeVisible();
    });

    it("says it here for an administrator, who belongs to no cohort", async () => {
      routeAccess.requireRouteAccess.mockResolvedValue({
        kind: "allow",
        session: {
          ...memberSession,
          user: { ...memberSession.user, systemRole: "super_admin" },
          memberships: [],
        },
      });

      render(
        await CampusPage({
          searchParams: Promise.resolve({ calendar: "connected" }),
        }),
      );

      expect(screen.getByRole("status")).toHaveTextContent(
        "Calendar outcome: connected",
      );
    });

    it.each([
      ["a word campus-api does not send", "hacked"],
      ["a list that starts with one", ["hacked", "connected"]],
    ])("ignores %s", async (_, calendar) => {
      render(
        await CampusPage({
          searchParams: Promise.resolve({
            calendar: calendar as string | string[],
          }),
        }),
      );

      expect(destinationAskedFor()).toBeUndefined();
      expect(screen.queryByRole("status")).toBeNull();
    });
  });
});
