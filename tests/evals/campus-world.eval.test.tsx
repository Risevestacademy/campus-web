import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ActiveCampusPage from "@/app/campus/[id]/(media-session)/(active-campus)/page";
import {
  type CampusWorldDependencies,
  CampusWorldHarness,
} from "@/features/campus-world/components/campus-world";
import type { StartCampusGame } from "@/features/campus-world/game/campus-game.types";
import { campusMapPreparationQueryKey } from "@/features/campus-world/hooks/use-prepared-campus-map";
import {
  type PreparedCampusMap,
  releasePreparedTilesetImage,
  takePreparedTilesetImages,
} from "@/features/campus-world/services/map/prepare-campus-map";

vi.mock("@/features/auth", () => ({
  CohortGate: ({
    children,
    cohortId,
  }: {
    children: ReactNode;
    cohortId: string;
  }) => (
    <section aria-label="Cohort gate" data-cohort-id={cohortId}>
      {children}
    </section>
  ),
}));
vi.mock("@/features/campus-world", () => ({
  CampusWorld: ({ cohortId }: { cohortId: string }) => (
    <div aria-label="Campus map" data-cohort-id={cohortId} role="region" />
  ),
}));

const projectRoot = path.resolve(import.meta.dirname, "../..");

function sourceFiles(directory: string): string[] {
  return readdirSync(path.join(projectRoot, directory), {
    recursive: true,
    withFileTypes: true,
  })
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.(?:ts|tsx)$/.test(entry.name) &&
        !entry.name.includes(".test."),
    )
    .map((entry) => path.join(entry.parentPath, entry.name));
}

const worldConfiguration = { dataset: "staging", projectId: "sj3zsz66" };

function renderPreparedWorld(
  dependencies: Omit<CampusWorldDependencies, "configuration">,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(
    campusMapPreparationQueryKey(worldConfiguration, { kind: "entry" }),
    {
      manifest: { mapId: "campus", version: "version-1" },
      preparationMs: 42,
      tilesets: Array.from({ length: 3 }, () => ({
        decodedImage: { close: vi.fn() } as unknown as ImageBitmap,
      })),
    } as unknown as PreparedCampusMap,
  );

  render(
    <QueryClientProvider client={queryClient}>
      <CampusWorldHarness
        cohortId="cohort-1"
        dependencies={{ ...dependencies, configuration: worldConfiguration }}
      />
    </QueryClientProvider>,
  );
}

const imageConsumptions: Array<
  [string, (prepared: PreparedCampusMap) => Promise<void> | void]
> = [
  [
    "takes every image before its first upload await",
    (prepared) => {
      takePreparedTilesetImages(prepared);
    },
  ],
  [
    "releases a single tileset image",
    (prepared) => {
      releasePreparedTilesetImage(prepared.tilesets[0]!);
    },
  ],
  [
    "releases every image after an upload await",
    async (prepared) => {
      await Promise.resolve();
      prepared.tilesets.forEach(releasePreparedTilesetImage);
    },
  ],
];

describe("Campus world eval (required threshold: 6/6)", () => {
  it.each(imageConsumptions)(
    "keeps a started world mounted when its game %s",
    async (_, consumeImages) => {
      const fetch = vi.fn();
      const loadImage = vi.fn();
      const quit = vi.fn();
      const startGame = vi.fn<StartCampusGame>(
        async (_container, _canvas, prepared) => {
          await consumeImages(prepared);
          return { quit };
        },
      );

      renderPreparedWorld({ fetch, loadImage, startGame });

      const region = screen.getByRole("region", { name: "Campus map" });
      await waitFor(() => {
        expect(region).toHaveAttribute("data-status", "ready");
      });
      expect(startGame).toHaveBeenCalledOnce();
      expect(quit).not.toHaveBeenCalled();
      expect(region.querySelector("canvas")?.isConnected).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
      expect(loadImage).not.toHaveBeenCalled();
    },
  );

  it("composes CampusWorld inside the cohort gate with the route cohort", async () => {
    render(
      await ActiveCampusPage({
        params: Promise.resolve({ id: "cohort-1" }),
      }),
    );

    const gate = screen.getByRole("region", { name: "Cohort gate" });
    expect(gate).toHaveAttribute("data-cohort-id", "cohort-1");
    expect(
      within(gate).getByRole("region", { name: "Campus map" }),
    ).toHaveAttribute("data-cohort-id", "cohort-1");
  });

  it("exposes only the active world and pre-join preparation boundary", async () => {
    const feature = await vi.importActual<
      typeof import("@/features/campus-world")
    >("@/features/campus-world");

    expect(Object.keys(feature).sort()).toEqual([
      "CampusMapPreparationGate",
      "CampusWorld",
    ]);
  });

  it("keeps KAPLAY out of the static application graph", () => {
    const staticKaplayImports = [
      ...sourceFiles("app"),
      ...sourceFiles("features/campus-world"),
    ].filter((file) =>
      /^import(?!\s+type\b)[\s\S]*?from\s+["']kaplay["'];/m.test(
        readFileSync(file, "utf8"),
      ),
    );

    expect(staticKaplayImports).toEqual([]);
  });
});
