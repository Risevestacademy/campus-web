import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CampusGame, StartCampusGame } from "../game/campus-game.types";
import { campusMapPreparationQueryKey } from "../hooks/use-prepared-campus-map";
import mapFixture from "../services/map/fixtures/campus-trimmed.json";
import {
  type CampusMapModule,
  type PreparedCampusMap,
  releasePreparedTilesetImage,
  takePreparedTilesetImages,
} from "../services/map/prepare-campus-map";
import {
  type CampusWorldDependencies,
  CampusWorldHarness,
} from "./campus-world";

const configuration = { dataset: "staging", projectId: "sj3zsz66" };
const mapUrl = "https://cdn.sanity.io/files/sj3zsz66/staging/campus-map.json";

function preparedMapFixture(): PreparedCampusMap {
  return {
    manifest: {
      mapId: "campus",
      version: "version-1",
    },
    preparationMs: 42,
    tilesets: Array.from({ length: 3 }, () => ({
      decodedImage: { close: vi.fn() } as unknown as ImageBitmap,
    })),
  } as unknown as PreparedCampusMap;
}

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

function mapFetch() {
  const manifest = {
    heightTiles: mapFixture.height,
    isEntry: true,
    mapId: "campus",
    mapUrl,
    tilesets: mapFixture.tilesets.map(({ image }) => ({
      tiledImagePath: image,
      url: `https://cdn.sanity.io/images/sj3zsz66/staging/${image.split("/").at(-1)}`,
    })),
    version: "version-1",
    widthTiles: mapFixture.width,
  };

  return vi.fn(async (input: RequestInfo | URL) =>
    String(input) === mapUrl
      ? response(mapFixture)
      : response({ result: [manifest] }),
  ) as unknown as typeof globalThis.fetch;
}

function renderWorld(
  dependencies: CampusWorldDependencies,
  cached: PreparedCampusMap | null = preparedMapFixture(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  if (cached !== null) {
    queryClient.setQueryData(
      campusMapPreparationQueryKey(dependencies.configuration, {
        kind: "entry",
      }),
      cached,
    );
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <CampusWorldHarness cohortId="cohort-1" dependencies={dependencies} />
    </QueryClientProvider>,
  );
}

describe("CampusWorld", () => {
  it("does not create a canvas before map preparation succeeds", async () => {
    const startGame = vi.fn(() => new Promise<CampusGame>(() => undefined));
    const loadImage = vi.fn(() => new Promise<ImageBitmap>(() => undefined));

    renderWorld(
      {
        configuration,
        fetch: mapFetch(),
        loadImage,
        loadKaplay: vi.fn(async () => ({}) as CampusMapModule),
        startGame,
      },
      null,
    );

    await waitFor(() => {
      expect(loadImage).toHaveBeenCalledTimes(mapFixture.tilesets.length);
    });
    const region = screen.getByRole("region", { name: "Campus map" });
    expect(region).toHaveAttribute("data-status", "loading-map");
    expect(region.querySelector("canvas")).toBeNull();
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

    renderWorld({ configuration, fetch, startGame }, preparedMap);

    const region = screen.getByRole("region", { name: "Campus map" });
    const canvas = region.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(region).toHaveAttribute("data-status", "loading-map");
    expect(
      screen.getByRole("status", { name: "Starting campus" }),
    ).toHaveTextContent("Starting your campus");
    expect(screen.queryByText("Loading campus map…")).not.toBeInTheDocument();
    expect(startGame).toHaveBeenCalledWith(
      region,
      canvas,
      preparedMap,
      expect.objectContaining({ onRenderError: expect.any(Function) }),
    );
    expect(fetch).not.toHaveBeenCalled();

    resolveGame?.({ quit: vi.fn() });
    await waitFor(() => {
      expect(region).toHaveAttribute("data-status", "ready");
    });
    expect(region).toHaveAttribute("data-map-id", "campus");
  });

  it("keeps its game running after it takes the prepared images", async () => {
    const captureEvent = vi.fn();
    const fetch = vi.fn();
    const loadImage = vi.fn();
    const quit = vi.fn();
    const startGame = vi.fn<StartCampusGame>(
      async (_container, _canvas, prepared) => {
        takePreparedTilesetImages(prepared);
        return { quit };
      },
    );

    renderWorld({ captureEvent, configuration, fetch, loadImage, startGame });

    const region = screen.getByRole("region", { name: "Campus map" });
    await waitFor(() => {
      expect(region).toHaveAttribute("data-status", "ready");
    });
    expect(startGame).toHaveBeenCalledOnce();
    expect(quit).not.toHaveBeenCalled();
    expect(region.querySelector("canvas")?.isConnected).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(loadImage).not.toHaveBeenCalled();
    expect(captureEvent).not.toHaveBeenCalled();
  });

  it("starts from consumed cached artwork without rehydrating", async () => {
    const fetch = vi.fn();
    const loadImage = vi.fn();
    const consumedMap = preparedMapFixture();
    consumedMap.tilesets.forEach(releasePreparedTilesetImage);
    const startGame = vi.fn<StartCampusGame>(async () => ({ quit: vi.fn() }));

    renderWorld({ configuration, fetch, loadImage, startGame }, consumedMap);

    const region = screen.getByRole("region", { name: "Campus map" });
    await waitFor(() => {
      expect(region).toHaveAttribute("data-status", "ready");
    });
    expect(startGame).toHaveBeenCalledWith(
      region,
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
    const startGame = vi.fn(async (_container, canvas, prepared) => {
      canvases.push(canvas);
      prepared.tilesets.forEach(releasePreparedTilesetImage);
      if (canvases.length === 1) {
        throw new Error("WebGL initialization failed.");
      }
      return { quit: vi.fn() };
    });

    renderWorld({ captureEvent, configuration, startGame });

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Campus map" }),
      ).toHaveAttribute("data-status", "ready");
    });
    expect(canvases).toHaveLength(2);
    expect(canvases[1]).not.toBe(canvases[0]);
    expect(captureEvent).toHaveBeenCalledWith("campus_world.map_failed", {
      error_kind: "render",
      map_id: "campus",
    });
  });

  it("fails without starting KAPLAY when public configuration is absent", async () => {
    const captureEvent = vi.fn();
    const startGame = vi.fn();

    renderWorld(
      {
        captureEvent,
        configuration: {},
        startGame,
      },
      null,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load the campus map.",
    );
    expect(startGame).not.toHaveBeenCalled();
    expect(captureEvent).toHaveBeenCalledWith("campus_world.map_failed", {
      error_kind: "config",
      map_id: null,
    });
  });

  it("quits its game on unmount without changing body styles", async () => {
    const bodyStyle = document.body.getAttribute("style");
    const quit = vi.fn();
    const startGame = vi.fn(async () => ({ quit }));
    const view = renderWorld({ configuration, startGame });

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Campus map" }),
      ).toHaveAttribute("data-status", "ready");
    });
    view.unmount();

    expect(quit).toHaveBeenCalledOnce();
    expect(document.body.getAttribute("style")).toBe(bodyStyle);
  });
});
