import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";

import { campusMapPreparationQueryKey } from "../hooks/use-prepared-campus-map";
import mapFixture from "../services/map/fixtures/campus-trimmed.json";
import {
  type CampusMapModule,
  type PreparedCampusMap,
  releasePreparedTilesetImage,
} from "../services/map/prepare-campus-map";
import {
  CampusMapPreparationGateHarness,
  type CampusMapPreparationGateHarnessProps,
} from "./campus-map-preparation-gate";

const dataset = "staging";
const projectId = "sj3zsz66";
const mapUrl = "https://cdn.sanity.io/files/sj3zsz66/staging/campus-map.json";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function preparationDependencies(
  loadImage: CampusMapPreparationGateHarnessProps["dependencies"]["loadImage"],
): CampusMapPreparationGateHarnessProps["dependencies"] {
  const manifest = {
    heightTiles: mapFixture.height,
    isEntry: true,
    mapId: "campus",
    mapUrl,
    tilesets: mapFixture.tilesets.map(({ image }) => ({
      tiledImagePath: image,
      url: `https://cdn.sanity.io/images/${projectId}/${dataset}/${image.split("/").at(-1)}`,
    })),
    version: "version-1",
    widthTiles: mapFixture.width,
  };

  return {
    configuration: { dataset, projectId },
    fetch: vi.fn(async (input: RequestInfo | URL) =>
      String(input) === mapUrl
        ? response(mapFixture)
        : response({ result: [manifest] }),
    ) as unknown as typeof globalThis.fetch,
    loadImage,
    loadKaplay: vi.fn(async () => ({}) as CampusMapModule),
  };
}

function renderGate(
  dependencies: CampusMapPreparationGateHarnessProps["dependencies"],
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }),
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <CampusMapPreparationGateHarness dependencies={dependencies}>
        <Link href="/campus/c-1">Join</Link>
      </CampusMapPreparationGateHarness>
    </QueryClientProvider>,
  );
}

describe("CampusMapPreparationGate", () => {
  it("keeps Join unavailable until every map asset is prepared", async () => {
    const resolveImages: Array<(image: ImageBitmap) => void> = [];
    const loadImage = vi.fn(
      () =>
        new Promise<ImageBitmap>((resolve) => {
          resolveImages.push(resolve);
        }),
    );

    renderGate(preparationDependencies(loadImage));

    expect(
      screen.queryByRole("link", { name: "Join" }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(loadImage).toHaveBeenCalledTimes(mapFixture.tilesets.length);
    });

    for (const resolveImage of resolveImages) {
      resolveImage({ close: vi.fn() } as unknown as ImageBitmap);
    }

    expect(await screen.findByRole("link", { name: "Join" })).toBeVisible();
  });

  it("reports decoded artwork progress without inventing work", async () => {
    const resolveImages: Array<(image: ImageBitmap) => void> = [];
    const loadImage = vi.fn(
      () =>
        new Promise<ImageBitmap>((resolve) => {
          resolveImages.push(resolve);
        }),
    );

    renderGate(preparationDependencies(loadImage));

    const progress = await screen.findByRole("progressbar", {
      name: "Campus artwork",
    });
    expect(progress).toHaveAttribute("aria-valuemax", "3");
    expect(progress).toHaveAttribute("aria-valuenow", "0");

    resolveImages[0]?.({ close: vi.fn() } as unknown as ImageBitmap);

    await waitFor(() => {
      expect(progress).toHaveAttribute("aria-valuenow", "1");
    });

    for (const resolveImage of resolveImages.slice(1)) {
      resolveImage({ close: vi.fn() } as unknown as ImageBitmap);
    }
  });

  it("starts fresh preparation after a network failure is retried", async () => {
    const captureEvent = vi.fn();
    const dependencies = preparationDependencies(
      async () => ({ close: vi.fn() }) as unknown as ImageBitmap,
    );
    dependencies.captureEvent = captureEvent;
    const successfulFetch = dependencies.fetch;
    let manifestRequests = 0;
    dependencies.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === mapUrl) {
        return successfulFetch!(input);
      }

      manifestRequests += 1;
      return manifestRequests === 1
        ? response({ error: "scripted" }, 503)
        : successfulFetch!(input);
    }) as unknown as typeof globalThis.fetch;

    renderGate(dependencies);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't prepare your campus.",
    );
    expect(
      screen.queryByRole("link", { name: "Join" }),
    ).not.toBeInTheDocument();
    expect(captureEvent).toHaveBeenCalledWith("campus_world.map_failed", {
      error_kind: "network",
      map_id: null,
    });

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "Join" })).toBeVisible();
    expect(manifestRequests).toBe(2);
    expect(captureEvent).toHaveBeenCalledTimes(2);
  });

  it("renders a render-ready cache hit immediately without preparing again", async () => {
    const loadImage = vi.fn(
      async () => ({ close: vi.fn() }) as unknown as ImageBitmap,
    );
    const dependencies = preparationDependencies(loadImage);
    const queryClient = new QueryClient();
    const firstView = renderGate(dependencies, queryClient);

    expect(await screen.findByRole("link", { name: "Join" })).toBeVisible();
    const preparedFetchCount = vi.mocked(dependencies.fetch!).mock.calls.length;
    firstView.unmount();

    renderGate(dependencies, queryClient);

    expect(screen.getByRole("link", { name: "Join" })).toBeVisible();
    expect(
      screen.queryByRole("status", { name: "Preparing campus" }),
    ).not.toBeInTheDocument();
    expect(loadImage).toHaveBeenCalledTimes(mapFixture.tilesets.length);
    expect(dependencies.fetch).toHaveBeenCalledTimes(preparedFetchCount);
  });

  it("blocks Join and rehydrates artwork after Active Campus consumes the cached images", async () => {
    const captureEvent = vi.fn();
    const repeatImageResolvers: Array<(image: ImageBitmap) => void> = [];
    const loadImage = vi
      .fn<() => Promise<ImageBitmap>>()
      .mockImplementationOnce(
        async () => ({ close: vi.fn() }) as unknown as ImageBitmap,
      )
      .mockImplementationOnce(
        async () => ({ close: vi.fn() }) as unknown as ImageBitmap,
      )
      .mockImplementationOnce(
        async () => ({ close: vi.fn() }) as unknown as ImageBitmap,
      )
      .mockImplementation(
        () =>
          new Promise<ImageBitmap>((resolve) => {
            repeatImageResolvers.push(resolve);
          }),
      );
    const dependencies = preparationDependencies(loadImage);
    dependencies.captureEvent = captureEvent;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const firstView = renderGate(dependencies, queryClient);

    expect(await screen.findByRole("link", { name: "Join" })).toBeVisible();
    const preparedFetchCount = vi.mocked(dependencies.fetch!).mock.calls.length;
    const prepared = queryClient.getQueryData<PreparedCampusMap>(
      campusMapPreparationQueryKey(dependencies.configuration, {
        kind: "entry",
      }),
    );
    expect(prepared).toBeDefined();
    prepared?.tilesets.forEach(releasePreparedTilesetImage);
    firstView.unmount();
    captureEvent.mockClear();

    renderGate(dependencies, queryClient);

    expect(
      screen.getByRole("status", { name: "Preparing campus" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Join" }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(loadImage).toHaveBeenCalledTimes(mapFixture.tilesets.length * 2);
    });
    expect(dependencies.fetch).toHaveBeenCalledTimes(preparedFetchCount);

    for (const resolveImage of repeatImageResolvers) {
      resolveImage({ close: vi.fn() } as unknown as ImageBitmap);
    }

    expect(await screen.findByRole("link", { name: "Join" })).toBeVisible();
    expect(captureEvent).toHaveBeenCalledOnce();
    expect(captureEvent).toHaveBeenCalledWith("campus_world.map_rehydrated", {
      load_ms: expect.any(Number),
      map_id: "campus",
      tilesets: 3,
      version: "version-1",
    });
  });

  it("reports a distinct failure when consumed artwork cannot be rehydrated", async () => {
    let rehydrating = false;
    const captureEvent = vi.fn();
    const loadImage = vi.fn(async () => {
      if (rehydrating) throw new Error("Image decoding failed.");
      return { close: vi.fn() } as unknown as ImageBitmap;
    });
    const dependencies = preparationDependencies(loadImage);
    dependencies.captureEvent = captureEvent;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const firstView = renderGate(dependencies, queryClient);

    expect(await screen.findByRole("link", { name: "Join" })).toBeVisible();
    const prepared = queryClient.getQueryData<PreparedCampusMap>(
      campusMapPreparationQueryKey(dependencies.configuration, {
        kind: "entry",
      }),
    );
    prepared?.tilesets.forEach(releasePreparedTilesetImage);
    firstView.unmount();
    captureEvent.mockClear();
    rehydrating = true;

    renderGate(dependencies, queryClient);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't prepare your campus.",
    );
    expect(
      screen.queryByRole("link", { name: "Join" }),
    ).not.toBeInTheDocument();
    expect(captureEvent).toHaveBeenCalledOnce();
    expect(captureEvent).toHaveBeenCalledWith(
      "campus_world.map_rehydration_failed",
      { error_kind: "network", map_id: "campus" },
    );
  });

  it("captures preparation success only when real preparation runs", async () => {
    const captureEvent = vi.fn();
    const dependencies = {
      ...preparationDependencies(
        async () => ({ close: vi.fn() }) as unknown as ImageBitmap,
      ),
      captureEvent,
      now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(142),
    };
    const queryClient = new QueryClient();
    const view = renderGate(dependencies, queryClient);

    expect(await screen.findByRole("link", { name: "Join" })).toBeVisible();
    expect(captureEvent).toHaveBeenCalledOnce();
    expect(captureEvent).toHaveBeenCalledWith("campus_world.map_loaded", {
      load_ms: 42,
      map_id: "campus",
      tilesets: 3,
      version: "version-1",
    });

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <CampusMapPreparationGateHarness dependencies={dependencies}>
          <Link href="/campus/c-1">Join</Link>
        </CampusMapPreparationGateHarness>
      </QueryClientProvider>,
    );
    expect(captureEvent).toHaveBeenCalledOnce();
  });
});
