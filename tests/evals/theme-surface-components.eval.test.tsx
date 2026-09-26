import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import ActiveCampusLayout from "@/app/(app)/campus/[id]/(active-campus)/layout";
import CampusPage from "@/app/(app)/campus/page";
import AuthLayout from "@/app/(auth)/layout";

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
    element: <CampusPage />,
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
    element: (
      <ActiveCampusLayout>
        <div />
      </ActiveCampusLayout>
    ),
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
