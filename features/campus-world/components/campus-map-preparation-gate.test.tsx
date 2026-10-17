import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";

import type { CampusMapDependencies as Dependencies } from "../hooks/campus-world-dependencies";
import { campusMapPreparationQueryKey } from "../hooks/use-campus-map-preparation";
import type {
  CampusMapModule,
  PreparedCampusMap,
} from "../services/map/prepare-campus-map";
import { fakeCampusRuntime } from "../testing/fake-campus-runtime";
import {
  fakeImage,
  jsonResponse,
  mapUrl,
  releasePreparedTilesetImage,
  sanityConfiguration,
  stubSanityFetch,
  tilesetCount,
} from "../testing/sanity-map-fixture";
import { CampusMapPreparationGate } from "./campus-map-preparation-gate";

function preparationDependencies(
  overrides: Partial<Dependencies> = {},
): Dependencies {
  return {
    captureEvent: vi.fn(),
    configuration: sanityConfiguration,
    fetch: stubSanityFetch(),
    loadImage: vi.fn(async () => fakeImage()),
    loadKaplay: vi.fn(async () => ({}) as CampusMapModule),
    runtime: fakeCampusRuntime(),
    ...overrides,
  };
}

function renderGate(
  dependencies: Dependencies,
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }),
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <CampusMapPreparationGate dependencies={dependencies}>
        <Link href="/campus/c-1">Join</Link>
      </CampusMapPreparationGate>
    </QueryClientProvider>,
  );
}

function consumeCachedImages(
  queryClient: QueryClient,
  dependencies: Dependencies,
) {
  const prepared = queryClient.getQueryData<PreparedCampusMap>(
    campusMapPreparationQueryKey(dependencies.configuration, {
      kind: "entry",
    }),
  );
  prepared?.tilesets.forEach(releasePreparedTilesetImage);
}

const joinLink = () => screen.queryByRole("link", { name: "Join" });

describe("CampusMapPreparationGate", () => {
  it("shows artwork progress and reveals Join only after every tileset decodes", async () => {
    const resolveImages: Array<(image: ImageBitmap) => void> = [];
    const dependencies = preparationDependencies({
      loadImage: vi.fn(
        () =>
          new Promise<ImageBitmap>((resolve) => {
            resolveImages.push(resolve);
          }),
      ),
      now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(142),
    });

    renderGate(dependencies);

    const progress = screen.getByRole("progressbar", {
      name: "Campus artwork",
    });
    expect(progress).not.toHaveAttribute("aria-valuenow");
    expect(joinLink()).not.toBeInTheDocument();

    await waitFor(() => {
      expect(progress).toHaveAttribute("aria-valuenow", "0");
    });
    expect(progress).toHaveAttribute("aria-valuemax", "3");

    resolveImages[0]?.(fakeImage());
    await waitFor(() => {
      expect(progress).toHaveAttribute("aria-valuenow", "1");
    });
    expect(joinLink()).not.toBeInTheDocument();

    resolveImages.slice(1).forEach((resolveImage) => resolveImage(fakeImage()));

    expect(await screen.findByRole("link", { name: "Join" })).toBeVisible();
    expect(dependencies.captureEvent).toHaveBeenCalledExactlyOnceWith(
      "campus_world.map_loaded",
      { load_ms: 42, map_id: "campus", tilesets: 3, version: "version-1" },
    );
  });

  it("starts fresh preparation after a network failure is retried", async () => {
    const successfulFetch = stubSanityFetch();
    let manifestRequests = 0;
    const dependencies = preparationDependencies({
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) !== mapUrl) manifestRequests += 1;
        return String(input) !== mapUrl && manifestRequests === 1
          ? jsonResponse({ error: "scripted" }, 503)
          : successfulFetch(input);
      }) as unknown as typeof globalThis.fetch,
    });

    renderGate(dependencies);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't prepare your campus.",
    );
    expect(joinLink()).not.toBeInTheDocument();
    expect(dependencies.captureEvent).toHaveBeenCalledWith(
      "campus_world.map_failed",
      { error_kind: "network", map_id: null },
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "Join" })).toBeVisible();
    expect(manifestRequests).toBe(2);
  });

  it("renders a render-ready cache hit immediately without preparing again", async () => {
    const dependencies = preparationDependencies();
    const queryClient = new QueryClient();
    const firstView = renderGate(dependencies, queryClient);

    expect(await screen.findByRole("link", { name: "Join" })).toBeVisible();
    const preparedFetchCount = vi.mocked(dependencies.fetch!).mock.calls.length;
    firstView.unmount();

    renderGate(dependencies, queryClient);

    expect(joinLink()).toBeVisible();
    expect(
      screen.queryByRole("status", { name: "Preparing campus" }),
    ).not.toBeInTheDocument();
    expect(dependencies.loadImage).toHaveBeenCalledTimes(tilesetCount);
    expect(dependencies.fetch).toHaveBeenCalledTimes(preparedFetchCount);
  });

  it("reveals Join at once on repeat entry while the runtime holds the map", async () => {
    const holdsMap = vi.fn(() => false);
    const dependencies = preparationDependencies({
      runtime: fakeCampusRuntime({ holdsMap }),
    });
    const queryClient = new QueryClient();
    const firstView = renderGate(dependencies, queryClient);

    expect(await screen.findByRole("link", { name: "Join" })).toBeVisible();
    const preparedFetchCount = vi.mocked(dependencies.fetch!).mock.calls.length;
    consumeCachedImages(queryClient, dependencies);
    firstView.unmount();
    holdsMap.mockReturnValue(true);

    renderGate(dependencies, queryClient);

    expect(joinLink()).toBeVisible();
    expect(
      screen.queryByRole("status", { name: "Preparing campus" }),
    ).not.toBeInTheDocument();
    expect(holdsMap).toHaveBeenCalledWith(
      expect.objectContaining({ mapId: "campus", version: "version-1" }),
    );
    expect(dependencies.loadImage).toHaveBeenCalledTimes(tilesetCount);
    expect(dependencies.fetch).toHaveBeenCalledTimes(preparedFetchCount);
  });

  it("prepares again when the runtime lost the consumed artwork", async () => {
    const dependencies = preparationDependencies();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const firstView = renderGate(dependencies, queryClient);

    expect(await screen.findByRole("link", { name: "Join" })).toBeVisible();
    consumeCachedImages(queryClient, dependencies);
    firstView.unmount();
    vi.mocked(dependencies.captureEvent!).mockClear();

    renderGate(dependencies, queryClient);

    expect(
      screen.getByRole("status", { name: "Preparing campus" }),
    ).toBeVisible();
    expect(joinLink()).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Join" })).toBeVisible();
    expect(dependencies.loadImage).toHaveBeenCalledTimes(tilesetCount * 2);
    expect(dependencies.captureEvent).toHaveBeenCalledExactlyOnceWith(
      "campus_world.map_loaded",
      expect.objectContaining({ map_id: "campus" }),
    );
  });
});
