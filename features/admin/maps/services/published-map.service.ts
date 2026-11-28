import {
  type Bounds,
  fetchWorldMapManifests,
  loadPublishedMap,
  readMapLayout,
} from "campus-world-map";

import type { PublishedMapRead } from "../types/maps.types";

interface SanitySource {
  dataset: string | undefined;
  projectId: string | undefined;
  fetch: typeof fetch;
}

// What readMapLayout reads, plus the image paths loadPublishedMap resolves.
// Typing the download as both needs no cast: the package validates the
// object layers itself.
type PublishedTiledMap = Parameters<typeof readMapLayout>[0] & {
  tilesets?: { image?: string; tiles?: { image?: string }[] }[];
};

const SANITY_CDN_ORIGIN = "https://cdn.sanity.io";
const REQUEST_TIMEOUT_MS = 10_000;
// Tile collision shapes count once per placed tile, so a big map can carry
// thousands. Past this the walls are left out rather than sent to the page.
const MAX_WALLS = 4_000;

type Rect = Extract<Bounds, { shape: "rect" }>;

// Joins rectangles that touch along one axis and match on the other: rows of
// tiles first, then those rows stacked into columns.
function joinRects(rects: readonly Rect[], axis: "x" | "y"): Rect[] {
  const across = axis === "x" ? "y" : "x";
  const length = axis === "x" ? "width" : "height";
  const thickness = axis === "x" ? "height" : "width";
  const sorted = rects.toSorted(
    (a, b) =>
      a[across] - b[across] || a[thickness] - b[thickness] || a[axis] - b[axis],
  );
  const joined: Rect[] = [];
  for (const rect of sorted) {
    const last = joined.at(-1);
    if (
      last &&
      last[across] === rect[across] &&
      last[thickness] === rect[thickness] &&
      rect[axis] <= last[axis] + last[length]
    ) {
      last[length] = Math.max(
        last[length],
        rect[axis] + rect[length] - last[axis],
      );
    } else {
      joined.push({ ...rect });
    }
  }
  return joined;
}

// Collision shapes count once per tile, so a fence of a hundred tiles would be
// a hundred rectangles. Touching tiles become one wall; polygons stay as they
// are.
export function mergeWalls(walls: readonly Bounds[]): Bounds[] {
  const rects = walls.filter((wall): wall is Rect => wall.shape === "rect");
  return [
    ...joinRects(joinRects(rects, "x"), "y"),
    ...walls.filter((wall) => wall.shape !== "rect"),
  ];
}

function isDatasetFile(
  url: string,
  projectId: string,
  dataset: string,
): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.origin === SANITY_CDN_ORIGIN &&
      parsed.pathname.startsWith(`/files/${projectId}/${dataset}/`)
    );
  } catch {
    return false;
  }
}

function checkedFetch(fetchImplementation: typeof fetch): typeof fetch {
  return async (input, init) => {
    const response = await fetchImplementation(input, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`The map request answered ${response.status}.`);
    }
    return response;
  };
}

function copyBounds(bounds: Bounds): Bounds {
  return bounds.shape === "rect"
    ? {
        shape: "rect",
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      }
    : {
        shape: "polygon",
        points: bounds.points.map(({ x, y }) => ({ x, y })),
      };
}

// The current published version of the map people enter on: what a sync
// would adopt. Read whole, then cut down to what the page draws.
export async function readPublishedEntryMap({
  dataset,
  projectId,
  fetch,
}: SanitySource): Promise<PublishedMapRead> {
  if (!dataset || !projectId) return { kind: "not-configured" };
  const request = checkedFetch(fetch);

  try {
    const manifests = await fetchWorldMapManifests({
      dataset,
      fetch: request,
      projectId,
    });
    const entry = manifests.find(({ isEntry }) => isEntry);
    if (!entry || !isDatasetFile(entry.mapUrl, projectId, dataset)) {
      return { kind: "unavailable" };
    }

    const published = await loadPublishedMap<PublishedTiledMap>(entry, {
      fetch: request,
    });
    const layout = readMapLayout(published);

    return {
      kind: "loaded",
      map: {
        mapKey: entry.mapId,
        version: entry.version,
        widthTiles: layout.widthTiles,
        heightTiles: layout.heightTiles,
        spaces: layout.spaces.map(({ key, name, bounds }) => ({
          key,
          name,
          bounds: copyBounds(bounds),
        })),
        desks: layout.desks.map(({ key, position }) => ({
          key,
          x: position.x,
          y: position.y,
        })),
        walls:
          layout.collisions.length > MAX_WALLS
            ? []
            : mergeWalls(layout.collisions.map(copyBounds)),
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
}
