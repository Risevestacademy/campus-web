import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setSidebarMode } from "@/features/campus/store/sidebar-store";
import { administrationLayout } from "@/tests/fixtures/administration-layout";

vi.mock("@/features/auth", () => ({
  AccountMenu: ({ children }: { children: ReactNode }) => children,
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

describe("administration Campus layout", () => {
  it("forces admin navigation around admin content without mounting meeting controls", async () => {
    setSidebarMode("campus");

    render(await administrationLayout(<p>Track administration</p>));

    const campusRail = screen.getByRole("navigation", { name: "Campus" });
    const administration = screen.getByRole("navigation", {
      name: "Administration pages",
    });

    expect(
      within(campusRail).getByRole("button", { name: "Administration" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(campusRail).getByRole("link", { name: "Campus overview" }),
    ).toHaveAttribute("href", "/campus/c-1");
    expect(administration).toBeInTheDocument();
    expect(screen.getByText("Track administration")).toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "Campus controls" }),
    ).not.toBeInTheDocument();
  });
});
