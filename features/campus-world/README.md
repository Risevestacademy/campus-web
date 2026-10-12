# Campus world

Owns preparing and drawing the published campus map. The Join Gate prepares
the current Sanity entry map before revealing its media controls. Active
Campus reuses that prepared resource and starts WebGL only after entry. This
feature does not own authentication, media, player movement, input, or
sockets.

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

Preparation success is not permanently render-ready. Active Campus consumes
decoded tileset images. A later gate rehydrates only those images before
revealing Join; reusable manifest, layout, and KAPLAY data stay cached.

## Modules

| Module        | Owns                                                          |
| ------------- | ------------------------------------------------------------- |
| `components/` | Preparation gate, canvas lifecycle, accessible status, retry  |
| `game/`       | KAPLAY startup, sprite upload, camera, and culled drawing     |
| `hooks/`      | Shared preparation query and lifecycle-store subscription     |
| `services/`   | Preparation, loading, bands, draw lists, frames, camera maths |
| `store/`      | Lifecycle transitions, attempt IDs, and stale-result guards   |
| `testing/`    | Sanity map fixtures and a fake KAPLAY band for tests          |

The feature may import `core` and `shared`. Routes compose it through the
barrel; other features do not import its internals.

## Contributing

- Keep KAPLAY behind `import("kaplay")`; preparation starts that dynamic
  import before the manifest request, without creating a hidden canvas or
  putting KAPLAY in the static module graph.
- Read Sanity configuration and analytics from
  `defaultCampusMapPreparationDependencies`. The Join Gate and `CampusWorld`
  share one query key only while they share that object.
- Keep the prepared query key scoped by Sanity project, dataset, and map
  source. It is session-cached with infinite stale and garbage-collection
  times and has no automatic retry.
- Treat readiness as parsed manifest/map data, every currently decoded
  tileset, and a resolved KAPLAY module. Query success alone is insufficient.
  Do not add artificial delays or progress.
- Mount through the React callback ref. Each attempt owns a fresh canvas and
  cleanup calls the matching game's `quit()`.
- Atomically take every decoded image before the first sprite-upload await,
  upload every tileset in parallel, then close each image after KAPLAY
  uploads it. Repeat pre-join rehydrates the
  images through their URLs instead of retaining CPU and GPU copies forever.
- The Join Gate alone rehydrates. `CampusWorld` observes through
  `useCampusWorldMap`, which never refetches on mount: the game takes the
  images during commit, before the observer subscribes, so a rehydrating
  observer would refetch tilesets and restart the game.
- Keep per-frame work in `game/`, not React state. React observes only
  lifecycle changes through `useSyncExternalStore`.
- Resolve tiles once through `buildBandDrawList`; a frame only walks visible
  cells layer by layer. Never iterate by tileset: layers that mix tilesets
  then draw out of order.
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

Unit tests cover preparation and rehydration completion, cancellation, cache
readiness, progress, retry protection, lifecycle, bands, layer draw order,
tile transforms, frames, and camera bounds. Shared fakes live in `testing/`. The Storybook browser test covers a post-upload
remount in real Chromium. Playwright covers request reuse across Join,
repeat-entry rehydration, Sanity stubbing, rendering, and resize.
