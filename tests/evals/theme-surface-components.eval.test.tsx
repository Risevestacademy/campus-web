import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ActiveCampusLayout from "@/app/(app)/campus/[id]/(active-campus)/layout";
import CampusLayout from "@/app/(app)/campus/[id]/layout";
import CampusPage from "@/app/(app)/campus/page";
import AuthLayout from "@/app/(auth)/layout";

// Surface roles are under test here, not route authorization or cohort data:
// stand in for an allowed member and skip the async chooser, which jsdom
// cannot render, so the Campus page's own markup is measured.
vi.mock("@/features/auth", () => ({
  requireRouteAccess: () =>
    Promise.resolve({
      kind: "allow",
      session: { user: { systemRole: "user" }, memberships: [] },
    }),
  CohortGate: ({ children }: { children: ReactNode }) => children,
  SessionUnavailable: () => null,
}));
vi.mock("@/core/api/client/server", () => ({
  getServerApi: () => Promise.resolve({}),
}));
vi.mock("@/features/campus", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/campus")>()),
  CohortChooser: () => null,
}));

const supportedSurfaceRoles = [
  "background",
  "surface",
  "surface-elevated",
] as const;

const structuralComponents: ReadonlyArray<{
  element: ReactElement;
  name: string;
}> = [
  {
    name: "campus page",
    element: await CampusPage({ searchParams: Promise.resolve({}) }),
  },
  {
    name: "auth layout",
    element: (
      <AuthLayout>
        <div />
      </AuthLayout>
    ),
  },
  {
    name: "active-campus layout",
    element: await CampusLayout({
      params: Promise.resolve({ id: "c-1" }),
      children: (
        <ActiveCampusLayout>
          <div />
        </ActiveCampusLayout>
      ),
    }),
  },
];

function expectSurfaceRolesToMatchClasses(container: HTMLElement) {
  const surfaces = [
    ...container.querySelectorAll<HTMLElement>("[data-surface-role]"),
  ];

  expect(surfaces.length).toBeGreaterThan(0);

  for (const surface of surfaces) {
    const role = surface.dataset.surfaceRole;

    expect(role).toBeTruthy();
    expect(supportedSurfaceRoles).toContain(role);

    if (role) {
      expect(surface).toHaveClass(`bg-${role}`);
    }
  }
}

describe("structural surface components (required threshold: 3/3)", () => {
  for (const { element, name } of structuralComponents) {
    it(`${name} aligns every surface marker with its utility`, () => {
      const { container } = render(element);

      expectSurfaceRolesToMatchClasses(container);
    });
  }
});
