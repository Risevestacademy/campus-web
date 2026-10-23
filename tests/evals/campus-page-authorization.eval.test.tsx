import { readdirSync } from "node:fs";
import path from "node:path";

import { cleanup, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ActiveCampusLayout from "@/app/campus/[id]/(active-campus)/layout";
import ActiveCampusMeetingPage from "@/app/campus/[id]/(active-campus)/meeting/page";
import ActiveCampusPage from "@/app/campus/[id]/(active-campus)/page";
import FeedbackPage from "@/app/campus/[id]/(administration)/feedback/page";
import AdministrationLayout from "@/app/campus/[id]/(administration)/layout";
import AdministrationOverviewPage from "@/app/campus/[id]/(administration)/overview/page";
import CohortTracksPage from "@/app/campus/[id]/(administration)/tracks/page";
import JoinPage from "@/app/campus/[id]/join/page";
import CohortLayout from "@/app/campus/[id]/layout";
import CampusPage from "@/app/campus/page";
import { requireRouteAccess } from "@/features/auth";

vi.mock("@/features/auth", () => ({
  AccountMenu: () => null,
  AnalyticsIdentity: () => null,
  CohortGate: ({ cohortId }: { cohortId: string }) => (
    <p role="alert">{`Cohort ${cohortId} access unavailable`}</p>
  ),
  isSystemAdministrator: () => true,
  normalizeCohortReturnTo: () => "/campus/protected-cohort",
  requireRouteAccess: vi.fn(() =>
    Promise.resolve({ kind: "unavailable", retryHref: "/campus" }),
  ),
  SessionRefreshProvider: ({ children }: { children: ReactNode }) => children,
  SessionRenewal: () => null,
  SessionUnavailable: () => <p role="alert">Route access unavailable</p>,
}));
vi.mock("@/features/campus", () => ({
  CampusJoinButton: () => null,
  CohortChooser: () => null,
  PreJoinPresenceTab: ({ children }: { children: ReactNode }) => children,
  PresenceSession: ({ children }: { children: ReactNode }) => (
    <section aria-label="Presence Session">{children}</section>
  ),
  VisualsDisplay: () => null,
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("404");
  },
}));

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const COHORT_DENIAL = "Cohort protected-cohort access unavailable";
const ROUTE_DENIAL = "Route access unavailable";
const SYSTEM_ADMIN = [[{ kind: "system-admin" }]];

const params = Promise.resolve({ id: "protected-cohort" });
const searchParams = Promise.resolve({});
const invalidParams = Promise.resolve({ id: "../protected-cohort" });

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
  "app/campus/[id]/(active-campus)/page.tsx": {
    render: () => ActiveCampusPage({ params }),
    denial: COHORT_DENIAL,
    routeAccessCalls: [],
  },
  "app/campus/[id]/(active-campus)/meeting/page.tsx": {
    render: () => ActiveCampusMeetingPage({ params }),
    denial: COHORT_DENIAL,
    routeAccessCalls: [],
  },
  "app/campus/[id]/join/page.tsx": {
    render: () => JoinPage({ params, searchParams }),
    denial: COHORT_DENIAL,
    routeAccessCalls: [],
  },
  "app/campus/[id]/(administration)/overview/page.tsx": {
    render: () => AdministrationOverviewPage({ params }),
    denial: ROUTE_DENIAL,
    routeAccessCalls: SYSTEM_ADMIN,
  },
  "app/campus/[id]/(administration)/feedback/page.tsx": {
    render: () => FeedbackPage({ params, searchParams }),
    denial: ROUTE_DENIAL,
    routeAccessCalls: SYSTEM_ADMIN,
  },
  "app/campus/[id]/(administration)/tracks/page.tsx": {
    render: () => CohortTracksPage({ params, searchParams }),
    denial: ROUTE_DENIAL,
    routeAccessCalls: SYSTEM_ADMIN,
  },
};

const INVALID_COHORT_ROUTES = [
  [
    "cohort layout",
    () => CohortLayout({ params: invalidParams, children: null }),
  ],
  ["active campus", () => ActiveCampusPage({ params: invalidParams })],
  [
    "active campus layout",
    () => ActiveCampusLayout({ params: invalidParams, children: null }),
  ],
  ["meeting", () => ActiveCampusMeetingPage({ params: invalidParams })],
  [
    "join",
    () =>
      JoinPage({ params: invalidParams, searchParams: Promise.resolve({}) }),
  ],
  [
    "administration overview",
    () => AdministrationOverviewPage({ params: invalidParams }),
  ],
  [
    "administration layout",
    () => AdministrationLayout({ params: invalidParams, children: null }),
  ],
  [
    "track administration",
    () => CohortTracksPage({ params: invalidParams, searchParams }),
  ],
] as const;

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

  it.each(INVALID_COHORT_ROUTES)(
    "%s rejects a malformed cohort ID before authorization or rendering",
    async (_, renderRoute) => {
      await expect(renderRoute()).rejects.toThrow("404");
      expect(requireRouteAccess).not.toHaveBeenCalled();
    },
  );

  it("renders only the cohort denial before the Presence Session mounts", async () => {
    const { container, queryByLabelText } = render(
      await CohortLayout({
        params,
        children: <p>Cohort page content</p>,
      }),
    );

    expect(container.textContent).toBe(COHORT_DENIAL);
    expect(queryByLabelText("Presence Session")).toBeNull();
  });
});
