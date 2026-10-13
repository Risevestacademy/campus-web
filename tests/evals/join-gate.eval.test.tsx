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

import ActiveCampusPage from "@/app/campus/[id]/(media-session)/(active-campus)/page";
import JoinPage from "@/app/campus/[id]/(media-session)/join/page";
import {
  createTestMediaDevice,
  installTestMediaDevices,
} from "@/features/campus/testing/media-session-test-utils";
import {
  activeCampusLayout,
  createActiveCampusAdmissionTestStore,
  createActiveCampusTestStore,
  mediaSessionLayout,
} from "@/tests/fixtures/active-campus-layout";

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
const MEDIA_SESSION_ROUTES = "app/campus/[id]/(media-session)/";
const MEDIA_SESSION_LAYOUT = `${MEDIA_SESSION_ROUTES}layout.tsx`;
// Campus exports that read the media session and so need its provider above.
const MEDIA_UI = /\b(?:VisualsDisplay|ActiveCampus)\b/;
const MEDIA_SESSION_PROVIDER = /\bCampusMediaSessionProvider\b/;

const params = Promise.resolve({ id: "c-1" });
let activeStore: ReturnType<typeof createActiveCampusTestStore> | undefined;

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
    const store = createActiveCampusTestStore();
    const admissionStore = createActiveCampusAdmissionTestStore();
    activeStore = store;
    await store.getState().start();
    const { rerender } = render(
      await mediaSessionLayout(
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

  it("renders media UI only under the shared media session", () => {
    expect(
      routeModulesMatching(MEDIA_UI).filter(
        (file) => !file.startsWith(MEDIA_SESSION_ROUTES),
      ),
    ).toEqual([]);
  });

  it("provides the media session only from the media-session layout", () => {
    expect(routeModulesMatching(MEDIA_SESSION_PROVIDER)).toEqual([
      MEDIA_SESSION_LAYOUT,
    ]);
  });
});
