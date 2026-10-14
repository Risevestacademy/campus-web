import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import ActiveCampusPage from "@/app/campus/[id]/(active-campus)/page";
import { CampusWorld } from "@/features/campus-world/components/campus-world";
import {
  type CampusRuntime,
  createCampusRuntime,
} from "@/features/campus-world/game/campus-runtime";
import type { CampusWorldDependencies } from "@/features/campus-world/hooks/campus-world-dependencies";
import { campusMapPreparationQueryKey } from "@/features/campus-world/hooks/use-campus-map-preparation";
import {
  isPreparedCampusMapRenderReady,
  type PreparedCampusMap,
  takePreparedTilesetImages,
} from "@/features/campus-world/services/map/prepare-campus-map";
import { fakeCampusRuntime } from "@/features/campus-world/testing/fake-campus-runtime";
import {
  fakeKaplay,
  fakePreparedMap,
} from "@/features/campus-world/testing/fake-kaplay";
import {
  addFakeBand,
  renderTilesets,
  squareLayer,
} from "@/features/campus-world/testing/fake-kaplay-band";
import {
  fakeImage,
  releasePreparedTilesetImage,
  sanityConfiguration,
} from "@/features/campus-world/testing/sanity-map-fixture";

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

function preparedQueryClient(prepared: PreparedCampusMap) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(
    campusMapPreparationQueryKey(sanityConfiguration, { kind: "entry" }),
    prepared,
  );
  return queryClient;
}

function renderWorld(
  queryClient: QueryClient,
  dependencies: Omit<CampusWorldDependencies, "configuration">,
) {
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <CampusWorld
          cohortId="cohort-1"
          dependencies={{ ...dependencies, configuration: sanityConfiguration }}
        />
      </QueryClientProvider>
    </StrictMode>,
  );
}

async function expectWorldReady() {
  await waitFor(() => {
    expect(screen.getByRole("region", { name: "Campus map" })).toHaveAttribute(
      "data-status",
      "ready",
    );
  });
}

interface LifecycleWorld {
  kaplay: ReturnType<typeof fakeKaplay>;
  reenter: () => void;
}

interface Lifecycle {
  act: (world: LifecycleWorld) => Promise<void>;
  failFirstUpload: boolean;
  kaplayStarts: number;
  name: string;
  readyStarts: number;
}

const lifecycles: Lifecycle[] = [
  {
    act: async () => undefined,
    failFirstUpload: false,
    kaplayStarts: 1,
    name: "a Strict Mode mount",
    readyStarts: 1,
  },
  {
    act: async ({ reenter }) => {
      reenter();
      await expectWorldReady();
    },
    failFirstUpload: false,
    kaplayStarts: 1,
    name: "leaving and re-entering",
    readyStarts: 2,
  },
  {
    act: async ({ kaplay }) => {
      fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
      await waitFor(() => expect(kaplay.uploads).toHaveLength(4));
      kaplay.uploads.slice(2).forEach((upload) => upload.finish());
      await expectWorldReady();
    },
    failFirstUpload: true,
    kaplayStarts: 2,
    name: "Try again after a failed sprite upload",
    readyStarts: 1,
  },
];

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

const drawTilesets = renderTilesets(["grounds", "terrains", "floors"]);

const layerArrangements: Array<[string, string[]]> = [
  ["ascending tilesets", ["grounds", "terrains", "floors"]],
  ["inverted tilesets", ["floors", "terrains", "grounds"]],
  ["interleaved tilesets", ["terrains", "grounds", "terrains", "floors"]],
  ["carpets above grass", ["grounds", "terrains", "floors", "grounds"]],
];

function tileFrom(tilesetName: string): number {
  return drawTilesets.find(({ name }) => name === tilesetName)!.firstgid;
}

describe("Campus world eval (required threshold: 13/13)", () => {
  it.each(layerArrangements)(
    "draws stacked layers bottom to top with %s",
    (_, layerTilesets) => {
      const band = addFakeBand(
        layerTilesets.map((name) => squareLayer([tileFrom(name)])),
        drawTilesets,
      );

      expect(band.drawFrame()).toEqual(layerTilesets);
    },
  );

  it.each(imageConsumptions)(
    "keeps a started world mounted when its game %s",
    async (_, consumeImages) => {
      const fetch = vi.fn();
      const loadImage = vi.fn();
      const stop = vi.fn();
      const start = vi.fn<CampusRuntime["start"]>(
        async (_container, prepared) => {
          await consumeImages(prepared);
          return { stop };
        },
      );
      const prepared = {
        manifest: { mapId: "campus", version: "version-1" },
        preparationMs: 42,
        tilesets: Array.from({ length: 3 }, () => ({
          decodedImage: fakeImage(),
        })),
      } as unknown as PreparedCampusMap;

      render(
        <QueryClientProvider client={preparedQueryClient(prepared)}>
          <CampusWorld
            cohortId="cohort-1"
            dependencies={{
              configuration: sanityConfiguration,
              fetch,
              loadImage,
              runtime: fakeCampusRuntime({ start }),
            }}
          />
        </QueryClientProvider>,
      );

      await expectWorldReady();
      expect(start).toHaveBeenCalledOnce();
      expect(stop).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      expect(loadImage).not.toHaveBeenCalled();
    },
  );

  it.each(lifecycles)(
    "keeps exactly one live map after $name",
    async ({ act, failFirstUpload, kaplayStarts, readyStarts }) => {
      const kaplay = fakeKaplay({ autoUpload: !failFirstUpload });
      const runtime = createCampusRuntime();
      const captureEvent = vi.fn();
      const queryClient = preparedQueryClient(fakePreparedMap(kaplay.module));
      const enter = () => renderWorld(queryClient, { captureEvent, runtime });
      let view = enter();

      if (failFirstUpload) {
        await waitFor(() => expect(kaplay.uploads).toHaveLength(2));
        kaplay.uploads[0]!.fail();
      } else {
        await expectWorldReady();
      }
      await act({
        kaplay,
        reenter: () => {
          view.unmount();
          view = enter();
        },
      });

      expect(kaplay.kaplay).toHaveBeenCalledTimes(kaplayStarts);
      expect(kaplay.contexts).toHaveLength(kaplayStarts);
      expect(kaplay.contexts.at(-1)!.liveObjects()).toBe(2);
      expect(
        captureEvent.mock.calls.filter(
          ([name]) => name === "campus_world.map_ready",
        ),
      ).toHaveLength(readyStarts);
    },
  );

  it("lets a repeat entry skip artwork the runtime still holds", async () => {
    const kaplay = fakeKaplay();
    const runtime = createCampusRuntime();
    const prepared = fakePreparedMap(kaplay.module);

    renderWorld(preparedQueryClient(prepared), { runtime }).unmount();
    await waitFor(() => expect(runtime.holdsMap(prepared.manifest)).toBe(true));

    expect(
      prepared.tilesets.every(({ decodedImage }) => decodedImage === undefined),
    ).toBe(true);
    expect(isPreparedCampusMapRenderReady(prepared, runtime.holdsMap)).toBe(
      true,
    );
  });

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
