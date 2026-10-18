import type { Page, Route } from "@playwright/test";

import mapFixture from "@/features/campus-world/services/map/fixtures/campus-trimmed.json" with { type: "json" };

const mapUrl = "https://cdn.sanity.io/files/sj3zsz66/staging/campus-map.json";
const transparentPixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

// The map identity every E2E fake agrees on: world announces it in its
// snapshot and Sanity publishes the matching manifest and artwork. Derived
// from the only artwork the harness serves, so the authoritative-dimension
// guard in the app is satisfied.
export const E2E_MAP = {
  id: "campus",
  version: "e2e-version",
  width: mapFixture.width,
  height: mapFixture.height,
} as const;

const manifest = {
  heightTiles: E2E_MAP.height,
  isEntry: true,
  mapId: E2E_MAP.id,
  mapUrl,
  tilesets: mapFixture.tilesets.map(({ image }) => ({
    tiledImagePath: image,
    url: `https://cdn.sanity.io/images/sj3zsz66/staging/${image.split("/").at(-1)}`,
  })),
  version: E2E_MAP.version,
  widthTiles: E2E_MAP.width,
};

export interface SanityMapRequestCounts {
  manifest: number;
  map: number;
  tilesets: number;
}

export async function installSanityMapStub(
  page: Page,
): Promise<SanityMapRequestCounts> {
  const requests: SanityMapRequestCounts = {
    manifest: 0,
    map: 0,
    tilesets: 0,
  };

  async function fulfillQuery(route: Route) {
    requests.manifest += 1;
    await route.fulfill({
      body: JSON.stringify({
        result: route.request().url().includes("%22worldMap%22")
          ? [manifest]
          : manifest,
      }),
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
  await page.route("https://cdn.sanity.io/images/**", (route) => {
    requests.tilesets += 1;
    return route.fulfill({ body: transparentPixel, contentType: "image/png" });
  });

  return requests;
}
