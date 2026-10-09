import { readdirSync } from "node:fs";
import path from "node:path";

import { cleanup, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdministrationOverviewPage from "@/app/campus/[id]/(administration)/overview/page";
import CohortTracksPage from "@/app/campus/[id]/(administration)/tracks/page";
import ActiveCampusMeetingPage from "@/app/campus/[id]/(media-session)/(active-campus)/meeting/page";
import ActiveCampusPage from "@/app/campus/[id]/(media-session)/(active-campus)/page";
import JoinPage from "@/app/campus/[id]/(media-session)/join/page";
import MediaSessionLayout from "@/app/campus/[id]/(media-session)/layout";
import CampusPage from "@/app/campus/page";
import { requireRouteAccess } from "@/features/auth";

vi.mock("@/features/auth", () => ({
  AccountMenu: () => null,
  CampusEntryLink: () => null,
  CohortGate: ({ cohortId }: { cohortId: string }) => (
    <p role="alert">{`Cohort ${cohortId} access unavailable`}</p>
  ),
  isSystemAdministrator: () => true,
  normalizeCohortReturnTo: () => "/campus/protected-cohort",
  requireRouteAccess: vi.fn(() =>
    Promise.resolve({ kind: "unavailable", retryHref: "/campus" }),
  ),
  SessionUnavailable: () => <p role="alert">Route access unavailable</p>,
}));
vi.mock("@/features/campus", () => ({
  CampusMediaSessionProvider: ({ children }: { children: ReactNode }) =>
    children,
  CohortChooser: () => null,
  VisualsDisplay: () => null,
}));
vi.mock("server-only", () => ({}));

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const COHORT_DENIAL = "Cohort protected-cohort access unavailable";
const ROUTE_DENIAL = "Route access unavailable";
const SYSTEM_ADMIN = [[{ kind: "system-admin" }]];

const params = Promise.resolve({ id: "protected-cohort" });
const searchParams = Promise.resolve({});

interface ProtectedPage {
  render: () => Promise<ReactElement>;
  denial: string;
  routeAccessCalls: unknown[][];
}

const PAGES: Record<string, ProtectedPage> = {
  "app/campus/page.tsx": {
    render: () => CampusPage({ searchParams }),
    denial: ROUTE_DENIAL,
    routeAccessCalls: [[{ kind: "campus-index" }]],
  },
  "app/campus/[id]/(media-session)/(active-campus)/page.tsx": {
    render: () => ActiveCampusPage({ params }),
    denial: COHORT_DENIAL,
    routeAccessCalls: [],
  },
  "app/campus/[id]/(media-session)/(active-campus)/meeting/page.tsx": {
    render: () => ActiveCampusMeetingPage({ params }),
    denial: COHORT_DENIAL,
    routeAccessCalls: [],
  },
  "app/campus/[id]/(media-session)/join/page.tsx": {
    render: () => JoinPage({ params, searchParams }),
    denial: COHORT_DENIAL,
    routeAccessCalls: [],
  },
  "app/campus/[id]/(administration)/overview/page.tsx": {
    render: () => AdministrationOverviewPage({ params }),
    denial: ROUTE_DENIAL,
    routeAccessCalls: SYSTEM_ADMIN,
  },
  "app/campus/[id]/(administration)/tracks/page.tsx": {
    render: () => CohortTracksPage({ params, searchParams }),
    denial: ROUTE_DENIAL,
    routeAccessCalls: SYSTEM_ADMIN,
  },
};

function pagesUnderCampus(): string[] {
  return readdirSync(path.join(PROJECT_ROOT, "app/campus"), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && entry.name === "page.tsx")
    .map((entry) =>
      path.relative(PROJECT_ROOT, path.join(entry.parentPath, entry.name)),
    );
}

afterEach(() => {
  cleanup();
  vi.mocked(requireRouteAccess).mockClear();
});

describe("Campus production page authorization", () => {
  it("covers every page under app/campus", () => {
    expect(pagesUnderCampus().sort()).toEqual(Object.keys(PAGES).sort());
  });

  it.each(Object.entries(PAGES))(
    "%s renders only its denial when access is refused",
    async (_, page) => {
      const { container } = render(await page.render());

      expect(container.textContent).toBe(page.denial);
      expect(vi.mocked(requireRouteAccess).mock.calls).toEqual(
        page.routeAccessCalls,
      );
    },
  );

  it("renders only the cohort denial before the media session mounts", async () => {
    const { container } = render(
      await MediaSessionLayout({
        params,
        children: <p>Media session content</p>,
      }),
    );

    expect(container.textContent).toBe(COHORT_DENIAL);
  });
});
