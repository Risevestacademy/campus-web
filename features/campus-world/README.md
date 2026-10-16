# Campus world

Owns preparing and drawing the published campus map. The Join Gate prepares
the current Sanity entry map before revealing its media controls. Active
Campus reuses that prepared resource and draws it on one KAPLAY runtime per
page. This feature does not own authentication, media, player movement,
input, or sockets.

## Interface

`index.ts` exposes two route-composition boundaries.

```tsx
<CampusMapPreparationGate>{joinGate}</CampusMapPreparationGate>
<CampusWorld cohortId={cohortId} />
```

`CampusMapPreparationGate` blocks its children until the manifest, map JSON,
tileset images, and lazy KAPLAY module are prepared. `CampusWorld` exposes the
accessible region `Campus map`, plus `data-status` and `data-map-id` for
browser verification. Its status progresses from `idle` to `loading-map`,
then to `ready` after first draw or recoverable `failed`.

A prepared map is render-ready while its tileset images are decoded or the
runtime already holds that map version's sprites. Active Campus consumes the
decoded images on first entry, so a repeat entry reveals Join at once. Only a
render or sprite-upload failure discards the runtime's sprites and makes the
gate prepare the map again.

Analytics: `campus_world.map_loaded` carries preparation time (`load_ms`);
`campus_world.map_ready` carries the time from game start to the first drawn
frame (`first_frame_ms`), once per ready start.

## Modules

| Module        | Owns                                                            |
| ------------- | --------------------------------------------------------------- |
| `components/` | Preparation gate and accessible map status, render only         |
| `game/`       | The page's KAPLAY runtime, sprite upload, and culled drawing    |
| `hooks/`      | Preparation query, game lifecycle, and store subscription       |
| `schemas/`    | The Tiled map fields the renderer reads                         |
| `services/`   | Preparation, errors, loading, bands, draw lists, camera, theme  |
| `store/`      | Lifecycle transitions, attempt IDs, and stale-result guards     |
| `testing/`    | Sanity fixtures, fake KAPLAY, fake runtime, and a fake map band |

The feature may import `core` and `shared`. Routes compose it through the
barrel; other features do not import its internals.

## Contributing

- Keep KAPLAY behind `import("kaplay")`; preparation starts that dynamic
  import before the manifest request, without creating a hidden canvas or
  putting KAPLAY in the static module graph.
- Read Sanity configuration, analytics, and the runtime from
  `defaultCampusWorldDependencies`. Both components accept a `dependencies`
  prop for tests and stories; pass a stable object, because a new object
  per render restarts the game. The query key follows its configuration.
- Keep the prepared query key scoped by Sanity project, dataset, and map
  source. It is session-cached with infinite stale and garbage-collection
  times and has no automatic retry.
- Treat the manifest and map JSON as untrusted. Map and tileset URLs must be
  assets of the configured Sanity project and dataset before anything fetches
  them, and the renderer only receives what `parseCampusTiledMap` returns. Add
  a field to `schemas/campus-map.schema.ts` before the renderer reads it.
  The one exception is the object layers: `readMapLayout` from
  `campus-world-map` validates them and throws a `LayoutError`, and its input
  is cast because the package's `loadPublishedMap<T>` rejects its own map
  type. Remove the cast when the package exports a type its loader accepts.
- Treat readiness as parsed manifest/map data, a resolved KAPLAY module, and
  either every tileset decoded or the runtime holding that version. Query
  success alone is insufficient. Do not add artificial delays or progress.
- Call `kaplay()` only inside `game/campus-runtime.ts`. KAPLAY keeps module
  globals, so a second context breaks the first and logs `KAPLAY already
initialized`. The runtime moves its one canvas between containers, clears
  the previous mount's map, and uploads each map version once (KAPLAY's
  texture packer never frees a re-upload). A render error or rejected
  sprite-upload batch replaces the context before retry.
- Mount through the React callback ref; cleanup calls the game's `stop()`.
- Atomically take every decoded image before the first sprite-upload await,
  upload every tileset in parallel, then close each image after KAPLAY
  uploads it.
- The Join Gate alone refetches. `CampusWorld` observes through
  `useCachedCampusMap`, which never refetches on mount: the game takes the
  images during commit, before the observer subscribes.
- Keep per-frame work in `game/`, not React state. React observes only
  lifecycle changes through `useSyncExternalStore`.
- Resolve tiles once through `buildBandDrawList`; a frame only walks cells
  whose rendered tiles can reach the viewport, layer by layer. Never iterate
  by tileset: layers that mix tilesets then draw out of order.
- Preserve the `avatars` tile layer as the below/above split marker. Hidden
  layers do not draw; without a marker every visible tile layer draws below.
- Use injected fetch and public Sanity configuration. Do not add a Sanity
  token for this public dataset.
- Add deterministic logic to `services/` and test stable outputs there before
  connecting it to KAPLAY.

## Tests

```bash
pnpm test features/campus-world
pnpm test tests/evals/campus-world.eval.test.tsx
pnpm test:storybook
pnpm test:e2e
```

Unit tests cover the runtime (one context, sprite reuse, stale starts, render
recovery), preparation, cancellation, readiness, progress, analytics,
lifecycle, bands, layer draw order, tile transforms, frames, camera, and the
theme background. Shared fakes live in `testing/`. The eval replays Strict
Mode, re-entry, and retry against the real runtime. The Storybook browser test
remounts in real Chromium and fails on the KAPLAY warning. Playwright covers
request reuse across Join and repeat entry, rendering, resize, and the
warning.
