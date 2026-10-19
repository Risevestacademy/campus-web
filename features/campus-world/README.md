# Campus world

Owns preparing and drawing the published campus map. The Join Gate prepares
the current Sanity entry map before revealing its media controls. Active
Campus reuses that prepared resource when it matches world's snapshot and
otherwise prepares the published map named there. It draws one KAPLAY runtime
per page, with everyone in the cohort on it. It owns the grid rules movement
follows: predicting a step, correcting it against world's `moveResult`, and
walking somebody else's `moved` gap. It also owns Arrow/WASD input and pacing
from world's `stepMs`. It does not own authentication, media, or sockets.

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
frame (`first_frame_ms`), once per ready start; and
`campus_world.move_corrected` carries a non-`moved` result (`outcome`).

## Modules

| Module        | Owns                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------- |
| `components/` | Preparation gate and accessible map status, render only                                     |
| `game/`       | The page's KAPLAY runtime, sprite upload, culled map, and avatars                           |
| `hooks/`      | Preparation query, game lifecycle, and store subscription                                   |
| `schemas/`    | The Tiled map fields the renderer reads                                                     |
| `services/`   | Preparation, errors, loading, bands, draw lists, avatars, camera, theme, and movement rules |
| `store/`      | Lifecycle transitions, attempt IDs, and stale-result guards                                 |
| `testing/`    | Sanity fixtures, fake KAPLAY, fake runtime, and a fake map band                             |

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
  times and has no automatic retry. Snapshot preparation reuses the entry
  preparation only when map ID, version and dimensions all match.
- Let presence name the map, and never the bundle: `CampusWorld` derives its
  map source from `presence.map` (world's snapshot). A snapshot naming a
  published map pins exactly that map id and version, so everyone loads the
  layout world enforces; until the first snapshot the cohort's key is not
  yet known and the map stays `loading-map`. A `placeholder` snapshot id and
  version renders tiles nowhere (`kind: "placeholder"`), locally, with no
  Sanity fetch. Pinned dimensions are checked against the artwork
  (`assertAuthoritativeDimensions`): a published map that disagrees with
  world fails loudly instead of drawing a lie.
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
- Keep input, sequence numbers, pending moves, prediction, interpolation, and
  buffering in KAPLAY's avatar layer. Never route per-frame movement through
  React or Zustand.
- Pace held input from world's `stepMs`. After a stalled frame, start only one
  new step. Reduced motion jumps each tile visually but keeps network pacing.
- Keep remote interpolation and catch-up queues inside KAPLAY. Walk `moved`
  gaps through `walkPath`, one orthogonal tile per `stepMs`. Snap snapshots,
  joins, unsafe reconstructed paths, reduced-motion displays, and queues that
  would exceed four steps. Face each step's travel direction, then apply
  world's authoritative facing at the destination.
- Keep canvas focusable and auto-focused. Its accessible label must name both
  Arrow keys and W, A, S, D.
- Resolve tiles once through `buildBandDrawList`; a frame only walks cells
  whose rendered tiles can reach the viewport, layer by layer. Never iterate
  by tileset: layers that mix tilesets then draw out of order.
- Preserve the `avatars` tile layer as the below/above split marker. Hidden
  layers do not draw; without a marker every visible tile layer draws below.
- Use injected fetch and public Sanity configuration. Do not add a Sanity
  token for this public dataset.
- Add deterministic logic to `services/` and test stable outputs there before
  connecting it to KAPLAY.
- Movement lives in `services/movement/`, as pure functions of tiles:
  `stepFrom`, `predictStep`, `reconcile` and `walkPath`. Walls come only from
  `blocked` in `campus-world-map`, the test world uses, through `isWalkable`,
  which adds the map edge. Never write a second wall test. `reconcile`
  follows world's `docs/world-protocol.md` "Moving yourself" and never reads
  `outcome`: world's `player` wins on every answer.
- Draw avatars from `@/core/presence` through `dependencies.presence`
  (default `presenceFor`); never from the socket. One object on the
  `avatars` layer draws everyone each frame from `positions`, nearer rows
  last. Every `spriteKey` draws the one placeholder (a circle, a dot toward
  `facing`, a ring for you) until character art exists. Once world has
  placed you, the camera follows your tile, clamped to the map.
- Escape every display name with `escapeStyledText` before KAPLAY sees it.
  KAPLAY reads `[tag]` as a style and throws on an unclosed one or a
  trailing `\`, and a throw inside a frame fails the whole map. Labels are
  laid out once per name with `formatText` and drawn with
  `drawFormattedText`.

## Tests

```bash
pnpm test features/campus-world
pnpm test tests/evals/campus-world.eval.test.tsx
pnpm eval:campus-world
pnpm test:storybook
pnpm test:e2e
```

Unit tests cover the runtime (one context, sprite reuse, stale starts, render
recovery), preparation, cancellation, readiness, progress, analytics,
lifecycle, bands, layer draw order, tile transforms, frames, camera, theme,
avatar drawing and label escaping, input pacing, and movement grid rules.
Shared fakes and the movement test layout live in `testing/`. The runtime eval replays Strict
Mode, re-entry, and retry. The avatar eval protects hostile display names and
unknown sprite keys. The movement eval replays recorded `moveResult` sessions
(a blocked step mid-burst, `too_fast` and recovery, an outcome added upstream)
and remote `moved` gaps through the frame controller. It fails on a correction
after a right prediction, a diagonal remote step, or a remote wall crossing.
Remote unit coverage protects interpolation, excess frame time, queue overflow,
reconnect snapshots, lifecycle changes, and reduced motion. The Storybook
browser test remounts in real Chromium and fails on the KAPLAY warning.
Playwright covers request reuse across Join and repeat entry, rendering,
resize, and the warning.
