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

`index.ts` exposes three route-composition boundaries.

```tsx
<CampusMapPreparationGate>{joinGate}</CampusMapPreparationGate>
<CampusWorld cohortId={cohortId} />
<ActiveCampus zoomControls={<CampusZoomControls />}>…</ActiveCampus>
```

`CampusMapPreparationGate` blocks its children until the manifest, map JSON,
tileset images, and lazy KAPLAY module are prepared. `CampusWorld` exposes the
accessible region `Campus map`, plus `data-status` and `data-map-id` for
browser verification. Its status progresses from `idle` to `loading-map`,
then to `ready` after first draw or recoverable `failed`.
`CampusZoomControls` is the `Zoom controls` group the active-campus layout
slots into the campus control bar; each button steps the running game's
camera and does nothing before the map is drawn.

A prepared map is render-ready while its tileset images are decoded or the
runtime already holds that map version's sprites. Active Campus consumes the
decoded images on first entry, so a repeat entry reveals Join at once. Only a
render or sprite-upload failure discards the runtime's sprites and makes the
gate prepare the map again.

Analytics: `campus_world.map_loaded` carries preparation time (`load_ms`);
`campus_world.map_ready` carries the time from game start to the first drawn
frame (`first_frame_ms`), once per ready start;
`campus_world.move_corrected` carries a non-`moved` result (`outcome`), only
when world's answer puts you somewhere other than predicted. Prediction treats
a tile world `refused` as a wall until world moves you onto it, so a key held
against a locked space reports once instead of every step; and
`campus_world.camera_zoomed` carries each new zoom level (`level`).

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
  texture packer never frees a re-upload). A render error, a lost WebGL
  context, or a rejected sprite-upload batch replaces the context before
  retry. KAPLAY never restores a lost context, and every texture goes with it.
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
- Pace held input from world's `stepMs`. A frame that runs past the end of a
  step carries the extra time into the next, so held walking averages
  `stepMs`. After a stalled frame, start only one new step and carry nothing.
  Reduced motion jumps each tile visually but keeps network pacing.
- Keep remote interpolation and catch-up queues inside KAPLAY. Walk `moved`
  gaps through `walkPath`, one orthogonal tile per `stepMs`. Snap snapshots,
  joins, unsafe reconstructed paths, reduced-motion displays, and queues that
  would exceed four steps. Face each step's travel direction, then apply
  world's authoritative facing at the destination.
- Keep canvas focusable and auto-focused. Its accessible label must name
  Arrow keys, W, A, S, D, plus and minus, and dragging. Zoom buttons prevent
  default on mousedown so a press leaves focus, and walking, on the canvas.
- Bake each band into 1024 px chunk textures as the camera reaches them
  (`makeCanvas`, cropped at the map edge, empty chunks skipped). A chunk in
  view bakes the frame it appears; a frame with nothing to bake in view bakes
  one chunk of the ring a chunk around the view, so walking rarely waits on a
  bake.
  Baked chunks stay until the band is destroyed. Tiles
  resolve through `buildBandDrawList`, and each chunk bakes the cells whose
  rendered tiles can reach it, layer by layer, so a tall tree crossing a
  chunk edge lands in both. Never iterate by tileset: layers that mix
  tilesets then draw out of order. A frame draws only the chunks the scaled
  viewport touches, one `drawUVQuad` each. Bake with `fixed` tiles, because
  the camera still applies inside `Canvas.draw`. KAPLAY maps framebuffer
  points through its game size, so the bake sets `k._k.gfx` width and
  height to the chunk's and restores them, as KAPLAY's `frameEnd` does.
  Never undo that stretch with `pushScale`: KAPLAY's rotate multiplies on
  the left, so a non-uniform scale squashes every rotated tile. Draw chunks
  with `flipY`: framebuffer textures store the bottom row first. A destroyed
  band frees the chunks it baked.
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
  placed you, the camera follows your drawn, predicted position each frame,
  clamped to the map, so it never waits for world's answer.
- `game/campus-camera.ts` owns the camera's frame state: zoom level, centre,
  and whether a drag or wheel zoom has set it free. Zoom levels are Whole
  map, 1x, 2x and 3x, default 2x. 1x to 3x are whole numbers, which keep
  pixel art sharp. Whole map is an overview: `cameraScale` fits the world to
  the canvas each frame, never past 1x, so it is fractional, rougher, and
  draws every map chunk with nothing culled. Each viewer's
  level is saved in `localStorage` (`services/zoom-preference.ts`, parsed
  with Zod). `+`, `=` and `-` zoom on the centre, except with Ctrl or Cmd,
  which stay the browser's. Wheel and pinch zoom toward the cursor, one level
  per gesture step. Dragging with a mouse or pen moves the map; the next
  Arrow or WASD press returns the camera to you. Touch belongs to mobile.
  Clamping and culling both use the scaled viewport (`visibleArea`), or edge
  tiles vanish and the camera shows past the map. Never copy the level into
  React or Zustand; React reaches it only through `runtime.zoom`.
- The camera eases every change except a drag, which tracks the pointer 1:1.
  `damp` in `services/camera.ts` is a frame-rate independent ease-out
  (`exp(-rate * dt)`), so 30 and 144 fps trace one path and a new target
  picks up mid-way. Zoom eases `log(scale)` at `ZOOM_RATE`, landing in under
  600 ms, and a wheel zoom keeps the point under the cursor on every frame.
  The centre trails you at `FOLLOW_RATE`, about a tile while you walk, and
  glides back after a drag. Each eased value lands exactly on its target, so
  settled frames match unanimated ones. At 1x to 3x the drawn position
  snaps to whole screen pixels (`snapToScreenPixel`) so crisp art does not
  shimmer; the eased centre keeps its fraction. Under reduced motion every
  change lands in one frame. Your avatar's own step stays linear: constant
  speed across held steps matches world's pace.
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
recovery, context loss), preparation, cancellation, readiness, progress,
analytics, lifecycle, bands, chunk baking and culling, layer draw order, tile
transforms, frames, camera math and easing,
zoom, drag, zoom preference, zoom buttons, scaled culling, theme,
avatar drawing and label escaping, input pacing, and movement grid rules.
Shared fakes and the movement test layout live in `testing/`. The runtime eval replays Strict
Mode, re-entry, retry, and a new map version from world with one live game, and
fails when a tile is missing from any chunk its art reaches, when any flip
or rotation bakes at the wrong size, when a chunk in view is not drawn, or when
a chunk beyond a chunk of the camera's path bakes. The avatar eval protects hostile display names and
unknown sprite keys. The movement eval replays recorded `moveResult` sessions
(a blocked step mid-burst, `too_fast` and recovery, an outcome added upstream)
and remote `moved` gaps through the frame controller. It fails on a correction
after a right prediction, a correction reported while held into a wall you
predicted, a diagonal remote step, a remote wall crossing, a
camera more than a tile behind your drawn avatar, or one that does not land
on you once you stop. Its zoom eval plays a fixed 200-action script of zooms,
wheel, drags, walks and resizes, and fails on any frame that shows past the
map, or any landed frame that draws at a scale its level does not give,
hides part of the map at Whole map, or is off you after a walk. Its easing
eval plays zooms, wheel zooms and recentres at 30 to 144 fps with uneven
frames, and fails when a first frame covers over a quarter of the change,
two rates disagree by a screen pixel, the cursor point drifts, a frame
leaves the pixel grid, or reduced motion shows an in-between frame. The storage eval reads
hostile stored zoom values back as 2x.
Remote unit coverage protects interpolation, excess frame time, queue overflow,
reconnect snapshots, lifecycle changes, and reduced motion. The Storybook
browser test remounts in real Chromium and fails on the KAPLAY warning.
Playwright covers request reuse across Join and repeat entry, rendering,
resize, and the warning. `campus-movement.spec.ts` drives a scripted world:
a held key sends one `move` per `stepMs` with rising `seq`, a `blocked` answer
snaps you back facing the new way, and a remote three-tile `moved` passes
through each tile of its L-shaped route. Frames compare by canvas digest
against references drawn in the same test; the remote walk steps a fake clock
one 16 ms frame at a time. `campus-world.spec.ts` zooms by key and by the
control-bar button, keeps walking keys on the canvas after a button press,
and restores the saved level on the next entry.
