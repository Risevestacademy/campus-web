// @vitest-environment node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const COHORT_ROUTES = path.join(PROJECT_ROOT, "app/campus/[id]");
const PRE_JOIN = "join";
const MAP_ROUTES = "(active-campus)";
const PRESENCE_SESSION_GATE = /<PresenceSessionGate\b/;
const PRESENCE_DOCK = /<PresenceDock\b/;
const CAMPUS_WORLD = /["']@\/features\/campus-world["']/;

function joinedRouteDirectories(): string[] {
  return readdirSync(COHORT_ROUTES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== PRE_JOIN)
    .map((entry) => entry.name)
    .sort();
}

function layoutSource(directory: string): string {
  const layout = path.join(COHORT_ROUTES, directory, "layout.tsx");
  return existsSync(layout) ? readFileSync(layout, "utf8") : "";
}

function routeSources(directory: string): string[] {
  return readdirSync(path.join(COHORT_ROUTES, directory), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .filter((entry) => !/\.test\.tsx?$/.test(entry.name))
    .map((entry) =>
      readFileSync(path.join(entry.parentPath, entry.name), "utf8"),
    );
}

describe("Presence Session routes (required threshold: every cohort page)", () => {
  it("has no cohort page outside a gated route group", () => {
    expect(existsSync(path.join(COHORT_ROUTES, "page.tsx"))).toBe(false);
  });

  it("gates every joined route group behind Join", () => {
    const ungated = joinedRouteDirectories().filter(
      (directory) => !PRESENCE_SESSION_GATE.test(layoutSource(directory)),
    );

    expect(ungated).toEqual([]);
  });

  it("shows the Presence Dock on every joined page that is not the map", () => {
    const withoutDock = joinedRouteDirectories()
      .filter((directory) => directory !== MAP_ROUTES)
      .filter((directory) => !PRESENCE_DOCK.test(layoutSource(directory)));

    expect(withoutDock).toEqual([]);
  });

  it("keeps map code off every page that is not the map", () => {
    const loadingMap = joinedRouteDirectories()
      .filter((directory) => directory !== MAP_ROUTES)
      .filter((directory) =>
        routeSources(directory).some((source) => CAMPUS_WORLD.test(source)),
      );

    expect(loadingMap).toEqual([]);
  });
});
