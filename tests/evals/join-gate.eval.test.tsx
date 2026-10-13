import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ActiveCampusPage from "@/app/campus/[id]/(active-campus)/page";
import JoinPage from "@/app/campus/[id]/join/page";
import {
  createTestMediaDevice,
  installTestMediaDevices,
} from "@/features/campus/testing/media-session-test-utils";
import { activeCampusLayout } from "@/tests/fixtures/active-campus-layout";
import { administrationLayout } from "@/tests/fixtures/administration-layout";
import {
  createPresenceAdmissionTestStore,
  createPresenceMediaTestStore,
  presenceSession,
} from "@/tests/fixtures/presence-session";

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock("@/features/auth", () => import("@/tests/fixtures/route-access-stub"));
vi.mock(
  "next/navigation",
  () => import("@/tests/fixtures/active-campus-navigation-stub"),
);
vi.mock("@/features/campus-world", () => ({
  CampusMapPreparationGate: ({ children }: { children: ReactNode }) => children,
  CampusWorld: () => null,
}));
vi.mock("server-only", () => ({}));

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const COHORT_ROUTES = "app/campus/[id]/";
const COHORT_LAYOUT = `${COHORT_ROUTES}layout.tsx`;
// Campus exports that read the media session and so need its provider above.
const MEDIA_UI = /\b(?:VisualsDisplay|ActiveCampus|PresenceDock)\b/;
const PRESENCE_SESSION = /<PresenceSession\b/;

const params = Promise.resolve({ id: "c-1" });
let activeStore: ReturnType<typeof createPresenceMediaTestStore> | undefined;

function routeModules(): string[] {
  return readdirSync(path.join(PROJECT_ROOT, "app"), {
    recursive: true,
    withFileTypes: true,
  })
    .filter(
      (entry) => entry.isFile() && /^(?:page|layout)\.tsx$/.test(entry.name),
    )
    .map((entry) =>
      path.relative(PROJECT_ROOT, path.join(entry.parentPath, entry.name)),
    );
}

function routeModulesMatching(pattern: RegExp): string[] {
  return routeModules().filter((file) =>
    pattern.test(readFileSync(path.join(PROJECT_ROOT, file), "utf8")),
  );
}

afterEach(() => {
  activeStore?.getState().stop();
  activeStore = undefined;
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Join Gate media session", () => {
  it("keeps the camera on from the Join Gate into Active Campus", async () => {
    installTestMediaDevices([
      createTestMediaDevice("camera-1", "videoinput", "Studio Camera"),
    ]);
    const store = createPresenceMediaTestStore();
    const admissionStore = createPresenceAdmissionTestStore();
    activeStore = store;
    await store.getState().start();
    const { rerender } = render(
      presenceSession(
        await JoinPage({ params, searchParams: Promise.resolve({}) }),
        store,
        admissionStore,
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Turn on camera" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Turn off camera" }),
      ).toHaveAttribute("aria-pressed", "true");
    });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    rerender(
      await activeCampusLayout(
        await ActiveCampusPage({ params }),
        store,
        admissionStore,
      ),
    );

    const controls = screen.getByRole("complementary", {
      name: "Campus controls",
    });
    expect(
      within(controls).getByRole("button", { name: "Turn off camera" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the same camera track from Active Campus into Cohort Administration", async () => {
    const mediaDevices = installTestMediaDevices([
      createTestMediaDevice("camera-1", "videoinput", "Studio Camera"),
    ]);
    const store = createPresenceMediaTestStore();
    const admissionStore = createPresenceAdmissionTestStore();
    activeStore = store;
    await store.getState().start();
    const { rerender } = render(
      await activeCampusLayout(
        await ActiveCampusPage({ params }),
        store,
        admissionStore,
      ),
    );
    const controls = screen.getByRole("complementary", {
      name: "Campus controls",
    });
    fireEvent.click(
      within(controls).getByRole("button", { name: "Turn on camera" }),
    );
    await waitFor(() => expect(store.getState().camera.track).not.toBeNull());
    const cameraTrack = store.getState().camera.track;

    rerender(
      await administrationLayout(<p>Overview</p>, store, admissionStore),
    );

    const dock = screen.getByRole("complementary", { name: "Presence dock" });
    expect(
      within(dock).getByRole("button", { name: "Turn off camera" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(store.getState().camera.track).toBe(cameraTrack);
    expect(mediaDevices.getUserMedia).toHaveBeenCalledOnce();
  });

  it("renders media UI only under the cohort's Presence Session", () => {
    expect(
      routeModulesMatching(MEDIA_UI).filter(
        (file) => !file.startsWith(COHORT_ROUTES),
      ),
    ).toEqual([]);
  });

  it("provides the Presence Session only from the cohort layout", () => {
    expect(routeModulesMatching(PRESENCE_SESSION)).toEqual([COHORT_LAYOUT]);
  });
});
