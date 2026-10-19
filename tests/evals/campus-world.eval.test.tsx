import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import ActiveCampusPage from "@/app/campus/[id]/(active-campus)/page";
import { createPresenceStore } from "@/core/presence";
import { createWorldMovementChannel } from "@/core/realtime";
import { CampusWorld } from "@/features/campus-world/components/campus-world";
import {
  type CampusRuntime,
  createCampusRuntime,
} from "@/features/campus-world/game/campus-runtime";
import type { CampusWorldDependencies } from "@/features/campus-world/hooks/campus-world-dependencies";
import { campusMapPreparationQueryKey } from "@/features/campus-world/hooks/use-campus-map-preparation";
import mapFixture from "@/features/campus-world/services/map/fixtures/campus-trimmed.json";
import {
  ENTRY_MAP,
  type MapSource,
  mapSourceFromSnapshot,
} from "@/features/campus-world/services/map/load-campus-map";
import {
  type CampusMapModule,
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
  entryManifest,
  fakeImage,
  releasePreparedTilesetImage,
  sanityConfiguration,
  stubSanityFetch,
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

// The world tells the truth about the map: one shape, matching the prepared
// manifest, so presence alone decides which artwork loads.
const WORLD_MAP = {
  height: 10,
  id: "campus",
  version: "version-1",
  width: 10,
};

function connectedPresence() {
  const store = createPresenceStore();
  store.getState().apply({ type: "snapshot", map: WORLD_MAP, players: [] });
  return store;
}

// The lower band, the avatar layer and the upper band.
const OBJECTS_PER_MAP = 3;
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

function preparedQueryClient(
  prepared: PreparedCampusMap,
  source: MapSource = mapSourceFromSnapshot(WORLD_MAP),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(
    campusMapPreparationQueryKey(sanityConfiguration, source),
    prepared,
  );
  return queryClient;
}

function renderWorld(
  queryClient: QueryClient,
  dependencies: Omit<
    CampusWorldDependencies,
    "configuration" | "movement" | "presence"
  >,
  presence = connectedPresence,
) {
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <CampusWorld
          cohortId="cohort-1"
          dependencies={{
            ...dependencies,
            configuration: sanityConfiguration,
            movement: () => createWorldMovementChannel(),
            presence,
          }}
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

const COVERAGE_TILE = 16;
const COVERAGE_SIDE = 12;
const coverageTilesets = renderTilesets(["grounds", "trees"]).map(
  (tileset, index) => ({ ...tileset, tileheight: index === 0 ? 16 : 46 }),
);
const coverageData = Array.from({ length: COVERAGE_SIDE ** 2 }, (_, index) => {
  if (index % 5 === 0) return coverageTilesets[1]!.firstgid;
  return index % 3 === 0 ? coverageTilesets[0]!.firstgid : 0;
});

interface Rect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  );
}

// Tiled draws a tile's art from its cell's bottom-left corner upwards.
function coverageTiles() {
  return coverageData.flatMap((gid, index) => {
    if (gid === 0) return [];
    const height = coverageTilesets.find(
      ({ firstgid, lastgid }) => gid >= firstgid && gid <= lastgid,
    )!.tileheight;
    const left = (index % COVERAGE_SIDE) * COVERAGE_TILE;
    const bottom = (Math.floor(index / COVERAGE_SIDE) + 1) * COVERAGE_TILE;
    return [
      {
        art: {
          bottom,
          left,
          right: left + COVERAGE_TILE,
          top: bottom - height,
        },
        centre: `${left + COVERAGE_TILE / 2},${bottom - height / 2}`,
      },
    ];
  });
}

function chunkRects(chunkSize: number): Rect[] {
  const world = COVERAGE_SIDE * COVERAGE_TILE;
  const rects: Rect[] = [];
  for (let top = 0; top < world; top += chunkSize) {
    for (let left = 0; left < world; left += chunkSize) {
      rects.push({
        bottom: Math.min(top + chunkSize, world),
        left,
        right: Math.min(left + chunkSize, world),
        top,
      });
    }
  }
  return rects;
}

describe("Campus world eval (required threshold: 18/18)", () => {
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

  it.each([16, 40, 1024])(
    "bakes every tile into each chunk its art reaches, with %i px chunks",
    (chunkSize) => {
      const band = addFakeBand([squareLayer(coverageData)], coverageTilesets, {
        chunkSize,
      });
      band.drawFrame();

      for (const chunk of chunkRects(chunkSize)) {
        const expected = coverageTiles()
          .filter(({ art }) => overlaps(art, chunk))
          .map(({ centre }) => centre);
        const quad = band
          .quads()
          .find(({ pos }) => pos.x === chunk.left && pos.y === chunk.top);
        const baked =
          band
            .canvases()
            .find(({ fb }) => fb.tex === quad?.tex)
            ?.draws.map(({ world }) => `${world.x},${world.y}`) ?? [];

        expect(baked).toEqual(expect.arrayContaining(expected));
      }
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
              movement: () => createWorldMovementChannel(),
              presence: () => connectedPresence(),
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

  it("reuses entry preparation when it matches world's snapshot", async () => {
    const fetch = vi.fn();
    const loadImage = vi.fn();
    const prepared = {
      manifest: {
        heightTiles: WORLD_MAP.height,
        mapId: WORLD_MAP.id,
        version: WORLD_MAP.version,
        widthTiles: WORLD_MAP.width,
      },
      map: { height: WORLD_MAP.height, width: WORLD_MAP.width },
      preparationMs: 42,
      tilesets: [],
    } as unknown as PreparedCampusMap;

    renderWorld(preparedQueryClient(prepared, ENTRY_MAP), {
      fetch,
      loadImage,
      runtime: fakeCampusRuntime(),
    });

    await expectWorldReady();
    expect(fetch).not.toHaveBeenCalled();
    expect(loadImage).not.toHaveBeenCalled();
  });

  it("follows a new map version world announces with one live game", async () => {
    const store = connectedPresence();
    const games: Array<{ stop: ReturnType<typeof vi.fn>; version: string }> =
      [];
    const start = vi.fn<CampusRuntime["start"]>(
      async (_container, prepared) => {
        const game = { stop: vi.fn(), version: prepared.manifest.version };
        games.push(game);
        return game;
      },
    );
    const prepared = {
      manifest: {
        heightTiles: WORLD_MAP.height,
        mapId: WORLD_MAP.id,
        version: WORLD_MAP.version,
        widthTiles: WORLD_MAP.width,
      },
      map: { height: WORLD_MAP.height, width: WORLD_MAP.width },
      preparationMs: 42,
      tilesets: [],
    } as unknown as PreparedCampusMap;

    renderWorld(
      preparedQueryClient(prepared),
      {
        fetch: stubSanityFetch(entryManifest("campus", true, "version-2")),
        loadImage: vi.fn(async () => fakeImage()),
        loadKaplay: vi.fn(async () => ({}) as CampusMapModule),
        runtime: fakeCampusRuntime({ start }),
      },
      () => store,
    );
    await expectWorldReady();
    act(() => {
      store.getState().apply({
        type: "snapshot",
        map: {
          height: mapFixture.height,
          id: "campus",
          version: "version-2",
          width: mapFixture.width,
        },
        players: [],
      });
    });

    await waitFor(() => {
      expect(games.at(-1)?.version).toBe("version-2");
    });
    await expectWorldReady();
    const live = games.filter(({ stop }) => stop.mock.calls.length === 0);
    expect(live.map(({ version }) => version)).toEqual(["version-2"]);
  });

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
      expect(kaplay.contexts.at(-1)!.liveObjects()).toBe(OBJECTS_PER_MAP);
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
