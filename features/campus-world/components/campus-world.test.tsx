import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CampusGame, StartCampusGame } from "../game/campus-game.types";
import { campusMapPreparationQueryKey } from "../hooks/use-prepared-campus-map";
import {
  type CampusMapModule,
  type PreparedCampusMap,
  releasePreparedTilesetImage,
} from "../services/map/prepare-campus-map";
import {
  fakeImage,
  sanityConfiguration,
  stubSanityFetch,
  tilesetCount,
} from "../testing/sanity-map-fixture";
import {
  type CampusWorldDependencies,
  CampusWorldHarness,
} from "./campus-world";

function preparedMapFixture(): PreparedCampusMap {
  return {
    manifest: { mapId: "campus", version: "version-1" },
    preparationMs: 42,
    tilesets: Array.from({ length: 3 }, () => ({ decodedImage: fakeImage() })),
  } as unknown as PreparedCampusMap;
}

function renderWorld(
  dependencies: Omit<CampusWorldDependencies, "configuration"> &
    Partial<Pick<CampusWorldDependencies, "configuration">>,
  cached: PreparedCampusMap | null = preparedMapFixture(),
) {
  const worldDependencies = {
    configuration: sanityConfiguration,
    ...dependencies,
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  if (cached !== null) {
    queryClient.setQueryData(
      campusMapPreparationQueryKey(worldDependencies.configuration, {
        kind: "entry",
      }),
      cached,
    );
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <CampusWorldHarness
        cohortId="cohort-1"
        dependencies={worldDependencies}
      />
    </QueryClientProvider>,
  );
}

const region = () => screen.getByRole("region", { name: "Campus map" });

async function expectReady() {
  await waitFor(() => {
    expect(region()).toHaveAttribute("data-status", "ready");
  });
}

describe("CampusWorld", () => {
  it("does not create a canvas before map preparation succeeds", async () => {
    const startGame = vi.fn(() => new Promise<CampusGame>(() => undefined));
    const loadImage = vi.fn(() => new Promise<ImageBitmap>(() => undefined));

    renderWorld(
      {
        fetch: stubSanityFetch(),
        loadImage,
        loadKaplay: vi.fn(async () => ({}) as CampusMapModule),
        startGame,
      },
      null,
    );

    await waitFor(() => {
      expect(loadImage).toHaveBeenCalledTimes(tilesetCount);
    });
    expect(region()).toHaveAttribute("data-status", "loading-map");
    expect(region().querySelector("canvas")).toBeNull();
    expect(startGame).not.toHaveBeenCalled();
  });

  it("uses cached preparation and waits for first draw readiness", async () => {
    let resolveGame: ((game: CampusGame) => void) | undefined;
    const startGame = vi.fn(
      () =>
        new Promise<CampusGame>((resolve) => {
          resolveGame = resolve;
        }),
    );
    const fetch = vi.fn();
    const preparedMap = preparedMapFixture();

    renderWorld({ fetch, startGame }, preparedMap);

    const canvas = region().querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(region()).toHaveAttribute("data-status", "loading-map");
    expect(
      screen.getByRole("status", { name: "Starting campus" }),
    ).toHaveTextContent("Starting your campus");
    expect(startGame).toHaveBeenCalledWith(
      region(),
      canvas,
      preparedMap,
      expect.objectContaining({ onRenderError: expect.any(Function) }),
    );
    expect(fetch).not.toHaveBeenCalled();

    resolveGame?.({ quit: vi.fn() });
    await expectReady();
    expect(region()).toHaveAttribute("data-map-id", "campus");
    expect(
      screen.queryByRole("status", { name: "Starting campus" }),
    ).not.toBeInTheDocument();
  });

  it("starts from consumed cached artwork without rehydrating", async () => {
    const fetch = vi.fn();
    const loadImage = vi.fn();
    const consumedMap = preparedMapFixture();
    consumedMap.tilesets.forEach(releasePreparedTilesetImage);
    const startGame = vi.fn<StartCampusGame>(async () => ({ quit: vi.fn() }));

    renderWorld({ fetch, loadImage, startGame }, consumedMap);

    await expectReady();
    expect(startGame).toHaveBeenCalledWith(
      region(),
      expect.any(HTMLCanvasElement),
      consumedMap,
      expect.objectContaining({ onRenderError: expect.any(Function) }),
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(loadImage).not.toHaveBeenCalled();
  });

  it("recovers from a render failure with a fresh canvas", async () => {
    const canvases: HTMLCanvasElement[] = [];
    const captureEvent = vi.fn();
    const startGame = vi.fn<StartCampusGame>(
      async (_container, canvas, prepared) => {
        canvases.push(canvas);
        prepared.tilesets.forEach(releasePreparedTilesetImage);
        if (canvases.length === 1) {
          throw new Error("WebGL initialization failed.");
        }
        return { quit: vi.fn() };
      },
    );

    renderWorld({ captureEvent, startGame });

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

    await expectReady();
    expect(canvases).toHaveLength(2);
    expect(canvases[1]).not.toBe(canvases[0]);
    expect(captureEvent).toHaveBeenCalledExactlyOnceWith(
      "campus_world.map_failed",
      { error_kind: "render", map_id: "campus" },
    );
  });

  it("fails without starting KAPLAY when public configuration is absent", async () => {
    const captureEvent = vi.fn();
    const startGame = vi.fn();

    renderWorld({ captureEvent, configuration: {}, startGame }, null);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load the campus map.",
    );
    expect(startGame).not.toHaveBeenCalled();
    expect(captureEvent).toHaveBeenCalledWith("campus_world.map_failed", {
      error_kind: "config",
      map_id: null,
    });
  });

  it("quits its game on unmount", async () => {
    const quit = vi.fn();
    const view = renderWorld({ startGame: vi.fn(async () => ({ quit })) });

    await expectReady();
    view.unmount();

    expect(quit).toHaveBeenCalledOnce();
  });
});
