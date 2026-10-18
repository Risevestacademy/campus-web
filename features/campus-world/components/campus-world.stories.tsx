import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { flushSync } from "react-dom";
import { expect, spyOn, userEvent, waitFor, within } from "storybook/test";

import { createPresenceStore } from "@/core/presence";
import type { Avatar } from "@/core/realtime";

import { campusRuntime } from "../game/campus-runtime";
import type { CampusWorldDependencies } from "../hooks/campus-world-dependencies";
import mapFixture from "../services/map/fixtures/campus-trimmed.json";
import { CampusWorld } from "./campus-world";

const mapUrl = "https://cdn.sanity.io/files/sj3zsz66/staging/map.json";
const tilesetUrl = "https://cdn.sanity.io/images/sj3zsz66/staging/";
const transparentPixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const manifestTilesets = mapFixture.tilesets.map(({ image }) => ({
  tiledImagePath: image,
  url: `${tilesetUrl}${image.split("/").at(-1)}`,
}));
const tilesetUrls = new Set(manifestTilesets.map(({ url }) => url));

const manifest = {
  heightTiles: mapFixture.height,
  isEntry: true,
  mapId: "campus",
  mapUrl,
  tilesets: manifestTilesets,
  version: "storybook-version",
  widthTiles: mapFixture.width,
};

const storyFetch = (async (input: RequestInfo | URL) => {
  const url = String(input);

  if (tilesetUrls.has(url)) {
    return globalThis.fetch(transparentPixel);
  }

  return new Response(
    JSON.stringify(
      url === mapUrl
        ? mapFixture
        : // The current-versions list reads its result as an array; the one
          // map a member's snapshot pins reads a single manifest. The query
          // text tells them apart before either is answered.
          {
            result: url.includes("%22worldMap%22") ? [manifest] : manifest,
          },
    ),
    { headers: { "Content-Type": "application/json" } },
  );
}) as typeof globalThis.fetch;

function storyPresence() {
  const store = createPresenceStore();
  store.getState().apply({
    type: "snapshot",
    map: {
      id: manifest.mapId,
      version: manifest.version,
      width: manifest.widthTiles,
      height: manifest.heightTiles,
    },
    players: [],
  });
  return store;
}

const dependencies: CampusWorldDependencies = {
  configuration: { dataset: "staging", projectId: "sj3zsz66" },
  fetch: storyFetch,
  presence: storyPresence,
  runtime: campusRuntime,
};

function CampusWorldRemountStory() {
  const [generation, setGeneration] = useState(0);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div className="bg-background grid h-dvh grid-rows-[auto_1fr] gap-2 p-2">
        <button
          className="bg-primary text-primary-foreground w-fit rounded-lg px-4 py-2"
          type="button"
          onClick={() => {
            flushSync(() => setGeneration((value) => value + 1));
          }}
        >
          Remount campus map
        </button>
        <CampusWorld
          key={generation}
          cohortId="storybook-cohort"
          dependencies={dependencies}
        />
      </div>
    </QueryClientProvider>
  );
}

const meta = {
  title: "Features/CampusWorld/Lifecycle",
  component: CampusWorldRemountStory,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"],
} satisfies Meta<typeof CampusWorldRemountStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RemountWithinOneFrame: Story = {
  play: async ({ canvasElement }) => {
    const story = within(canvasElement);
    const warn = spyOn(console, "warn");
    const region = story.getByRole("region", { name: "Campus map" });

    await waitFor(
      async () => {
        await expect(region).toHaveAttribute("data-status", "ready");
      },
      { timeout: 10_000 },
    );
    const firstCanvas = region.querySelector("canvas");

    await userEvent.click(
      story.getByRole("button", { name: "Remount campus map" }),
    );

    await waitFor(
      async () => {
        const replacementRegion = story.getByRole("region", {
          name: "Campus map",
        });
        const replacementCanvas = replacementRegion.querySelector("canvas");
        await expect(replacementRegion).not.toBe(region);
        await expect(replacementRegion).toHaveAttribute("data-status", "ready");
        await expect(replacementCanvas).toBe(firstCanvas);
        await expect(replacementCanvas?.width).toBeGreaterThan(0);
        await expect(replacementCanvas?.height).toBeGreaterThan(0);
      },
      { timeout: 10_000 },
    );

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    await expect(
      story.getByRole("region", { name: "Campus map" }).querySelector("canvas")
        ?.isConnected,
    ).toBe(true);
    await expect(warn).not.toHaveBeenCalledWith(
      expect.stringMatching(/KAPLAY already initialized/),
    );
  },
};

// Each would throw in KAPLAY's text formatter if drawn unescaped.
const HOSTILE_DISPLAY_NAMES = [
  "Ada\\",
  "[b]Grace",
  "Lin [/i]",
  "[b][/i]",
  "[".repeat(200),
  "名前 👋",
  "\u202Eevil",
  "",
];

function hostilePresence() {
  const store = createPresenceStore();
  const players: Avatar[] = HOSTILE_DISPLAY_NAMES.map((displayName, index) => ({
    displayName,
    facing: "down",
    spriteKey: index % 2 === 0 ? null : "no-such-sprite",
    userId: `member-${index}`,
    x: 2 + index,
    y: 2 + (index % 3),
  }));
  store.getState().apply({
    type: "snapshot",
    map: {
      id: "campus",
      version: "storybook-version",
      width: mapFixture.width,
      height: mapFixture.height,
    },
    players,
  });
  return store;
}

function CampusWorldAvatarsStory() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  const [avatarDependencies] = useState(() => {
    const presence = hostilePresence();
    return { ...dependencies, presence: () => presence };
  });

  return (
    <QueryClientProvider client={queryClient}>
      <div className="bg-background h-dvh p-2">
        <CampusWorld
          cohortId="storybook-cohort"
          dependencies={avatarDependencies}
        />
      </div>
    </QueryClientProvider>
  );
}

export const HostileDisplayNames: Story = {
  render: () => <CampusWorldAvatarsStory />,
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole("region", {
      name: "Campus map",
    });

    await waitFor(
      async () => {
        await expect(region).toHaveAttribute("data-status", "ready");
      },
      { timeout: 10_000 },
    );
    for (let frame = 0; frame < 30; frame += 1) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }

    await expect(region).toHaveAttribute("data-status", "ready");
  },
};
