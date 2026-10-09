import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setSidebarMode } from "@/features/campus/store/sidebar-store";
import { activeCampusLayout } from "@/tests/fixtures/active-campus-layout";

vi.mock("@/features/auth", () => ({
  AccountMenu: ({ children }: { children: ReactNode }) => children,
  isSystemAdministrator: (role: string) =>
    role === "admin" || role === "super_admin",
  logsOutFromRail: () => false,
  requireRouteAccess: () =>
    Promise.resolve({
      kind: "allow",
      session: {
        scope: "full_access",
        expiresAt: "2099-01-01T00:15:00.000Z",
        inviteId: null,
        user: {
          id: "admin-1",
          displayName: "Ada Admin",
          email: "ada@campus.local",
          systemRole: "admin",
        },
        memberships: [],
      },
    }),
  SessionUnavailable: () => null,
}));
vi.mock("server-only", () => ({}));

afterEach(() => {
  window.localStorage.clear();
  Reflect.deleteProperty(document.documentElement.dataset, "sidebarOpen");
});

describe("administrator sidebar navigation", () => {
  it("opens administration navigation without replacing Campus content", async () => {
    render(await activeCampusLayout(<p>Campus route content</p>));

    const campusRail = screen.getByRole("navigation", { name: "Campus" });

    expect(screen.getByText("Campus route content")).toBeInTheDocument();

    fireEvent.click(
      within(campusRail).getByRole("button", { name: "Administration" }),
    );

    const administration = screen.getByRole("navigation", {
      name: "Administration pages",
    });

    expect(
      within(administration).getByRole("link", { name: "Overview" }),
    ).toHaveAttribute("href", "/campus/c-1/overview");
    expect(
      within(administration).getByRole("link", {
        name: "Programme Tracks",
      }),
    ).toHaveAttribute("href", "/campus/c-1/tracks");
    expect(within(administration).getAllByRole("link")).toHaveLength(2);
  });

  it("restores Administration mode when an administrator re-enters Active Campus", async () => {
    setSidebarMode("admin");

    render(await activeCampusLayout(<p>Campus route content</p>));

    expect(
      screen.getByRole("navigation", { name: "Administration pages" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Campus route content")).toBeInTheDocument();
  });
});
