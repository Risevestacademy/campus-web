import type { Page, Route } from "@playwright/test";

import mapFixture from "@/features/campus-world/services/map/fixtures/campus-trimmed.json" with { type: "json" };

const mapUrl = "https://cdn.sanity.io/files/sj3zsz66/staging/campus-map.json";
const transparentPixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const manifest = {
  heightTiles: mapFixture.height,
  isEntry: true,
  mapId: "campus",
  mapUrl,
  tilesets: mapFixture.tilesets.map(({ image }) => ({
    tiledImagePath: image,
    url: `https://cdn.sanity.io/images/sj3zsz66/staging/${image.split("/").at(-1)}`,
  })),
  version: "e2e-version",
  widthTiles: mapFixture.width,
};

interface SanityMapStubOptions {
  tilesetResponseGate?: {
    afterRequests: number;
    wait: Promise<void>;
  };
}

export interface SanityMapRequestCounts {
  manifest: number;
  map: number;
  tilesets: number;
}

export async function installSanityMapStub(
  page: Page,
  options: SanityMapStubOptions = {},
): Promise<SanityMapRequestCounts> {
  const requests: SanityMapRequestCounts = {
    manifest: 0,
    map: 0,
    tilesets: 0,
  };

  async function fulfillQuery(route: Route) {
    requests.manifest += 1;
    await route.fulfill({
      body: JSON.stringify({ result: [manifest] }),
      contentType: "application/json",
    });
  }

  await page.route("https://*.api.sanity.io/**", fulfillQuery);
  await page.route("https://*.apicdn.sanity.io/**", fulfillQuery);
  await page.route(mapUrl, (route) => {
    requests.map += 1;
    return route.fulfill({
      body: JSON.stringify(mapFixture),
      contentType: "application/json",
    });
  });
  await page.route("https://cdn.sanity.io/images/**", async (route) => {
    requests.tilesets += 1;
    const gate = options.tilesetResponseGate;
    if (gate && requests.tilesets > gate.afterRequests) {
      await gate.wait;
    }
    await route.fulfill({ body: transparentPixel, contentType: "image/png" });
  });

  return requests;
}
