import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createAdmissionStore } from "@/features/campus/services/presence-session/admission-store";
import { followPresenceTab } from "@/features/campus/services/presence-session/follow-presence-tab";
import { createPresenceTab } from "@/features/campus/services/presence-session/presence-tab";
import {
  createFakeLockManager,
  createFakeNoticeBus,
  settle,
} from "@/features/campus/testing/fake-presence-locks";
import { createCountingMediaSession } from "@/features/campus/testing/presence-tab-test-utils";
import { createTestWorldSession } from "@/features/campus/testing/world-session-test-utils";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const CAMPUS_FEATURE = path.join(PROJECT_ROOT, "features/campus");
const TAB_COHORTS: Record<string, string> = {
  A: "c-3",
  B: "c-3",
  C: "c-4",
  D: "c-3",
};

type Action = "camera" | "crash" | "join" | "leave" | "open" | "useHere";

// Each step is "<tabs> <action>", e.g. "A join" or "B+D useHere" (at once).
const SCENARIOS: { name: string; steps: string[]; connected: string[] }[] = [
  {
    name: "a second tab opens on a joined cohort",
    steps: ["A open", "A camera", "A join", "B open", "B camera"],
    connected: ["A"],
  },
  {
    name: "Use here moves the session",
    steps: ["A open", "A camera", "A join", "B open", "B useHere"],
    connected: ["B"],
  },
  {
    name: "the first tab takes it back",
    steps: ["A open", "A join", "B open", "B useHere", "A useHere"],
    connected: ["A"],
  },
  {
    name: "two tabs press Use here at once",
    steps: ["A open", "A join", "B open", "D open", "B+D useHere"],
    connected: ["D"],
  },
  {
    name: "two tabs press Join at once",
    steps: ["A open", "B open", "A+B join"],
    connected: ["A"],
  },
  {
    name: "a previewing tab yields when another joins",
    steps: ["A open", "B open", "A camera", "B camera", "A join"],
    connected: ["A"],
  },
  {
    name: "the holder leaves and another joins",
    steps: ["A open", "A join", "B open", "A leave", "B camera", "B join"],
    connected: ["B"],
  },
  {
    name: "the holder crashes and another joins",
    steps: ["A open", "A join", "B open", "A crash", "B join"],
    connected: ["B"],
  },
  {
    name: "another cohort joins alongside",
    steps: ["A open", "A camera", "A join", "C open", "C camera", "C join"],
    connected: ["A", "C"],
  },
];

function createBrowser() {
  const lockManager = createFakeLockManager();
  const openNotices = createFakeNoticeBus();
  const wakeListeners = new Set<() => void>();

  // Mirrors PresenceSessionProvider, the Join button and both Use here paths.
  function openTab(name: string) {
    const cohortId = TAB_COHORTS[name] as string;
    const media = createCountingMediaSession();
    const admission = createAdmissionStore();
    const tab = createPresenceTab(cohortId, {
      locks: lockManager.forClient(name),
      openNotices,
      report() {},
      subscribeToWake(listener) {
        wakeListeners.add(listener);
        return () => wakeListeners.delete(listener);
      },
    });
    void media.store.getState().start();
    const world = createTestWorldSession();
    const stopFollowing = followPresenceTab(tab, media.store, admission, world);
    const close = tab.open();
    const showsMediaControls = () =>
      tab.getStatus() === "vacant" || tab.getStatus() === "held";

    return {
      cohortId,
      media,
      liveWorldSockets: () =>
        ["idle", "closed"].includes(world.getStatus().phase) ? 0 : 1,
      status: tab.getStatus,
      actions: {
        async camera() {
          if (showsMediaControls()) {
            await media.store.getState().toggleSource("camera");
          }
        },
        async crash() {
          stopFollowing();
          lockManager.crash(name);
          media.store.getState().stop();
          world.close();
          wakeListeners.forEach((listener) => listener());
        },
        async join() {
          if (!(await tab.claim())) return;
          media.store.getState().connect(cohortId);
          world.connect();
        },
        async leave() {
          close();
          stopFollowing();
          media.store.getState().stop();
          world.close();
        },
        async open() {},
        async useHere() {
          await tab.takeOver();
          media.store.getState().connect(cohortId);
          world.connect();
        },
      } satisfies Record<Action, () => Promise<void>>,
    };
  }

  return { openTab };
}

type SimulatedTab = ReturnType<ReturnType<typeof createBrowser>["openTab"]>;

async function play(
  steps: string[],
  afterEachStep: (tabs: Map<string, SimulatedTab>) => void,
) {
  const browser = createBrowser();
  const tabs = new Map<string, SimulatedTab>();

  for (const step of steps) {
    const [names, action] = step.split(" ") as [string, Action];
    await Promise.all(
      names.split("+").map(async (name) => {
        if (!tabs.has(name)) tabs.set(name, browser.openTab(name));
        await tabs.get(name)?.actions[action]();
        // A crashed tab's page is gone, so it no longer counts.
        if (action === "crash") tabs.delete(name);
      }),
    );
    await settle();
    afterEachStep(tabs);
  }

  return tabs;
}

// Pre-join tabs hold nothing, so two may preview before anyone joins. Once a
// tab holds the cohort, it alone may capture, and a cohort connects once.
function presenceViolations(tabs: Map<string, SimulatedTab>): string[] {
  const cohorts = new Map<string, SimulatedTab[]>();
  for (const tab of tabs.values()) {
    cohorts.set(tab.cohortId, [...(cohorts.get(tab.cohortId) ?? []), tab]);
  }

  return [...cohorts].flatMap(([cohortId, cohortTabs]) => {
    const holders = cohortTabs.filter((tab) => tab.status() === "held");
    const live = {
      connections: sum(cohortTabs, (tab) => tab.media.liveConnections()),
      holders: holders.length,
      worldSockets: sum(cohortTabs, (tab) => tab.liveWorldSockets()),
      tracksOutsideHolder: holders.length
        ? sum(cohortTabs, (tab) =>
            tab.status() === "held" ? 0 : tab.media.liveTracks(),
          )
        : 0,
    };
    const isValid =
      live.connections <= 1 &&
      live.holders <= 1 &&
      live.worldSockets <= 1 &&
      live.tracksOutsideHolder === 0;
    return isValid ? [] : [`${cohortId}: ${JSON.stringify(live)}`];
  });
}

function sum(tabs: SimulatedTab[], count: (tab: SimulatedTab) => number) {
  return tabs.reduce((total, tab) => total + count(tab), 0);
}

function campusSources(): string[] {
  return readdirSync(CAMPUS_FEATURE, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .filter(
      (entry) =>
        !/\.test\.tsx?$|\/testing\//.test(
          path.join(entry.parentPath, entry.name),
        ),
    )
    .map((entry) =>
      path.relative(PROJECT_ROOT, path.join(entry.parentPath, entry.name)),
    );
}

function filesMatching(pattern: RegExp): string[] {
  return campusSources().filter((file) =>
    pattern.test(readFileSync(path.join(PROJECT_ROOT, file), "utf8")),
  );
}

describe("Presence Tab eval (threshold: every case passes)", () => {
  it.each(SCENARIOS)(
    "$name: only the joined tab captures or connects, after every step",
    async ({ connected, steps }) => {
      const violations: string[] = [];

      const tabs = await play(steps, (liveTabs) => {
        violations.push(...presenceViolations(liveTabs));
      });

      expect(violations).toEqual([]);
      expect(
        [...tabs]
          .filter(([, tab]) => tab.media.liveConnections() > 0)
          .map(([name]) => name),
      ).toEqual(connected);
      expect(
        [...tabs]
          .filter(([, tab]) => tab.liveWorldSockets() > 0)
          .map(([name]) => name),
      ).toEqual(connected);
    },
  );

  it("keeps the lock and its browser APIs inside the Presence Tab adapters", () => {
    expect(filesMatching(/campus-presence:/)).toEqual([
      "features/campus/services/presence-session/presence-tab.ts",
    ]);
    expect(filesMatching(/navigator\.locks|BroadcastChannel/)).toEqual([
      "features/campus/services/presence-session/browser-presence-tab.ts",
    ]);
  });

  it("renders pre-join device setup only inside the Presence Tab check", () => {
    const joinPage = readFileSync(
      path.join(PROJECT_ROOT, "app/campus/[id]/join/page.tsx"),
      "utf8",
    );

    expect(joinPage).toMatch(
      /<PreJoinPresenceTab[\s\S]*<VisualsDisplay[\s\S]*<\/PreJoinPresenceTab>/,
    );
  });
});
