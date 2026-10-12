import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CampusGame, CampusRuntime } from "../game/campus-runtime";
import type { CampusWorldDependencies } from "../hooks/campus-world-dependencies";
import { campusMapPreparationQueryKey } from "../hooks/use-campus-map-preparation";
import type {
  CampusMapModule,
  PreparedCampusMap,
} from "../services/map/prepare-campus-map";
import { fakeCampusRuntime } from "../testing/fake-campus-runtime";
import {
  fakeImage,
  releasePreparedTilesetImage,
  sanityConfiguration,
  stubSanityFetch,
  tilesetCount,
} from "../testing/sanity-map-fixture";
import { CampusWorld } from "./campus-world";

function preparedMapFixture(): PreparedCampusMap {
  return {
    manifest: { mapId: "campus", version: "version-1" },
    preparationMs: 42,
    tilesets: Array.from({ length: 3 }, () => ({ decodedImage: fakeImage() })),
  } as unknown as PreparedCampusMap;
}

function renderWorld(
  overrides: Partial<CampusWorldDependencies> = {},
  cached: PreparedCampusMap | null = preparedMapFixture(),
) {
  const dependencies: CampusWorldDependencies = {
    captureEvent: vi.fn(),
    configuration: sanityConfiguration,
    fetch: vi.fn(),
    loadImage: vi.fn(),
    runtime: fakeCampusRuntime(),
    ...overrides,
  };
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

  const view = render(
    <QueryClientProvider client={queryClient}>
      <CampusWorld cohortId="cohort-1" dependencies={dependencies} />
    </QueryClientProvider>,
  );
  return { dependencies, view };
}

function startedGame() {
  let resolveGame: ((game: CampusGame) => void) | undefined;
  const start = vi.fn<CampusRuntime["start"]>(
    () =>
      new Promise<CampusGame>((resolve) => {
        resolveGame = resolve;
      }),
  );
  return {
    finish: () => resolveGame?.({ stop: vi.fn() }),
    runtime: fakeCampusRuntime({ start }),
    start,
  };
}

const region = () => screen.getByRole("region", { name: "Campus map" });

async function expectReady() {
  await waitFor(() => {
    expect(region()).toHaveAttribute("data-status", "ready");
  });
}

describe("CampusWorld", () => {
  it("does not start the game before map preparation succeeds", async () => {
    const runtime = fakeCampusRuntime();
    const loadImage = vi.fn(() => new Promise<ImageBitmap>(() => undefined));

    renderWorld(
      {
        fetch: stubSanityFetch(),
        loadImage,
        loadKaplay: vi.fn(async () => ({}) as CampusMapModule),
        runtime,
      },
      null,
    );

    await waitFor(() => {
      expect(loadImage).toHaveBeenCalledTimes(tilesetCount);
    });
    expect(region()).toHaveAttribute("data-status", "loading-map");
    expect(runtime.start).not.toHaveBeenCalled();
  });

  it("uses cached preparation and waits for the first frame", async () => {
    const game = startedGame();
    const preparedMap = preparedMapFixture();
    const { dependencies } = renderWorld(
      { runtime: game.runtime },
      preparedMap,
    );

    expect(region()).toHaveAttribute("data-status", "loading-map");
    expect(
      screen.getByRole("status", { name: "Starting campus" }),
    ).toHaveTextContent("Starting your campus");
    expect(game.start).toHaveBeenCalledWith(
      region(),
      preparedMap,
      expect.objectContaining({ onRenderError: expect.any(Function) }),
    );
    expect(dependencies.fetch).not.toHaveBeenCalled();

    game.finish();
    await expectReady();
    expect(region()).toHaveAttribute("data-map-id", "campus");
    expect(
      screen.queryByRole("status", { name: "Starting campus" }),
    ).not.toBeInTheDocument();
  });

  it("reports the time from game start to the first frame", async () => {
    const game = startedGame();
    const { dependencies } = renderWorld({
      now: vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(1_250),
      runtime: game.runtime,
    });

    game.finish();
    await expectReady();

    expect(dependencies.captureEvent).toHaveBeenCalledExactlyOnceWith(
      "campus_world.map_ready",
      { first_frame_ms: 250, map_id: "campus", version: "version-1" },
    );
  });

  it("starts from consumed cached artwork without preparing again", async () => {
    const consumedMap = preparedMapFixture();
    consumedMap.tilesets.forEach(releasePreparedTilesetImage);
    const { dependencies } = renderWorld({}, consumedMap);

    await expectReady();
    expect(dependencies.runtime.start).toHaveBeenCalledWith(
      region(),
      consumedMap,
      expect.objectContaining({ onRenderError: expect.any(Function) }),
    );
    expect(dependencies.fetch).not.toHaveBeenCalled();
    expect(dependencies.loadImage).not.toHaveBeenCalled();
  });

  it("starts the runtime again when Try again follows a failed start", async () => {
    const start = vi
      .fn<CampusRuntime["start"]>()
      .mockRejectedValueOnce(new Error("WebGL initialization failed."))
      .mockResolvedValue({ stop: vi.fn() });
    const { dependencies } = renderWorld({
      runtime: fakeCampusRuntime({ start }),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

    await expectReady();
    expect(start).toHaveBeenCalledTimes(2);
    expect(dependencies.captureEvent).toHaveBeenCalledWith(
      "campus_world.map_failed",
      { error_kind: "render", map_id: "campus" },
    );
    expect(dependencies.captureEvent).toHaveBeenCalledTimes(2);
  });

  it("fails once when rendering breaks after the map was ready", async () => {
    const { dependencies } = renderWorld();
    await expectReady();
    const [, , { onRenderError }] = vi.mocked(dependencies.runtime.start).mock
      .calls[0]!;

    onRenderError();
    onRenderError();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load the campus map.",
    );
    expect(dependencies.captureEvent).toHaveBeenCalledWith(
      "campus_world.map_failed",
      { error_kind: "render", map_id: "campus" },
    );
    expect(
      vi
        .mocked(dependencies.captureEvent!)
        .mock.calls.filter(([name]) => name === "campus_world.map_failed"),
    ).toHaveLength(1);
  });

  it("fails without starting the game when public configuration is absent", async () => {
    const { dependencies } = renderWorld({ configuration: {} }, null);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load the campus map.",
    );
    expect(dependencies.runtime.start).not.toHaveBeenCalled();
    expect(dependencies.captureEvent).toHaveBeenCalledWith(
      "campus_world.map_failed",
      { error_kind: "config", map_id: null },
    );
  });

  it("stops its game on unmount", async () => {
    const stop = vi.fn();
    const { view } = renderWorld({
      runtime: fakeCampusRuntime({ start: vi.fn(async () => ({ stop })) }),
    });

    await expectReady();
    view.unmount();

    expect(stop).toHaveBeenCalledOnce();
  });

  it("cancels a game still starting when the world unmounts", async () => {
    const game = startedGame();
    const { view } = renderWorld({ runtime: game.runtime });
    const [, , { signal }] = game.start.mock.calls[0]!;

    view.unmount();

    expect(signal.aborted).toBe(true);
  });
});
