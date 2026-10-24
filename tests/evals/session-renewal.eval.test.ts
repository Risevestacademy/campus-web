// @vitest-environment node

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const COHORT_LAYOUT = path.join(PROJECT_ROOT, "app/campus/[id]/layout.tsx");
const AUTH_PROXY_ENTRY = path.join(PROJECT_ROOT, "features/auth/proxy.ts");
const BACKEND_CALLS =
  /\bfetch\(|getServerApi|browserApi|createApiClient|createSessionRefresher/;
// Type-only imports are erased, so they never reach the proxy bundle.
const RELATIVE_IMPORT =
  /^(?:import|export)(?!\s+type\b)[^;]*?from\s+["'](\.{1,2}\/[^"']+)["']/gm;
const API_CLIENT_IMPORT =
  /import\s*{([^}]*)}\s*from\s*["']@\/core\/api\/client["']/g;
const SESSION_REFRESH_PATH = "/session/refresh";

function read(file: string): string {
  return readFileSync(file, "utf8");
}

function resolveModule(from: string, specifier: string): string {
  const base = path.resolve(path.dirname(from), specifier);
  return [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find(
    (candidate) => {
      try {
        readFileSync(candidate);
        return true;
      } catch {
        return false;
      }
    },
  ) as string;
}

function proxyModules(): string[] {
  const seen = new Set<string>();
  const pending = [AUTH_PROXY_ENTRY];

  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const [, specifier] of read(file).matchAll(RELATIVE_IMPORT)) {
      pending.push(resolveModule(file, specifier as string));
    }
  }

  return [...seen];
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .filter((entry) => !/\.test\.tsx?$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function campusSources(): string[] {
  const campusFeatures = readdirSync(path.join(PROJECT_ROOT, "features"))
    .filter((name) => name.startsWith("campus"))
    .map((name) => path.join(PROJECT_ROOT, "features", name));
  return [path.join(PROJECT_ROOT, "app/campus"), ...campusFeatures].flatMap(
    sourceFiles,
  );
}

describe("Session Renewal eval (threshold: every case holds)", () => {
  it("mounts Session Renewal for the cohort, outside the keyed Presence Session", () => {
    const layout = read(COHORT_LAYOUT);
    const gate = layout.indexOf("<CohortGate");
    const renewal = layout.indexOf("<CohortSession");
    const presenceOpen = layout.indexOf("<PresenceSession");
    const presenceClose = layout.indexOf("</PresenceSession>");

    expect(renewal).toBeGreaterThan(gate);
    expect(gate).toBeGreaterThanOrEqual(0);
    expect(renewal < presenceOpen || renewal > presenceClose).toBe(true);
    expect(renewal).toBeLessThan(layout.indexOf("</CohortGate>"));
  });

  it("keeps the proxy cookie-only: nothing it imports calls the backend", () => {
    const modules = proxyModules();
    const calling = modules.filter((file) => BACKEND_CALLS.test(read(file)));
    const apiClientNames = modules.flatMap((file) =>
      [...read(file).matchAll(API_CLIENT_IMPORT)].flatMap(([, names]) =>
        (names as string).split(",").map((name) => name.trim()),
      ),
    );

    expect(modules.length).toBeGreaterThan(1);
    expect(calling).toEqual([]);
    expect(apiClientNames.filter((name) => !/_COOKIE$/.test(name))).toEqual([]);
  });

  it("never sends a cohort page to the refresh page itself", () => {
    const referencing = campusSources()
      .filter((file) => read(file).includes(SESSION_REFRESH_PATH))
      .map((file) => path.relative(PROJECT_ROOT, file));

    expect(referencing).toEqual([]);
  });
});
