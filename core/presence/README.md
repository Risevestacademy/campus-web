# Presence

Who is in a cohort's campus, and where world last placed them. It is applied
from the realtime client's messages and read by the campus map (and, later,
the roster). It never parses a frame: `core/realtime` already did.

## Interface

```ts
import {
  applyServerMessage,
  createPresenceStore,
  presenceFor,
  type Presence,
} from "@/core/presence";

const presence = presenceFor(cohortId);
presence.getState().apply(message); // from the realtime client's onEvent
presence.getState().clear(); // when the Presence Session ends
```

`Presence` holds:

- `selfId`: your `userId`, from `welcome`.
- `participants`: who is here, `Map<userId, { userId, displayName, spriteKey }>`.
- `positions`: where they stand, `Map<userId, { x, y, facing }>` in tiles.

They are two maps so React can subscribe to who is here without rendering on
every `moved` tick. KAPLAY reads `positions` each frame and keeps anything
finer (pixels, walking) itself.

| Message      | participants             | positions                  |
| ------------ | ------------------------ | -------------------------- |
| `welcome`    | (sets `selfId`)          |                            |
| `snapshot`   | replaced                 | replaced                   |
| `joined`     | set, replacing any entry | set                        |
| `appearance` | updated if present       |                            |
| `left`       | removed                  | removed                    |
| `moved`      |                          | updated for known ids      |
| `moveResult` |                          | yours, from world's answer |

- A `snapshot` replaces both maps rather than patching them. After a
  reconnect, patching would keep whoever left while the socket was down.
- One entry per id by construction, so a reconnect never draws anyone twice.
- `Map`, not `Record`: an id such as `constructor` must not reach
  `Object.prototype`.
- A message that changes nothing returns the same object, and the store
  tells no subscriber.

`presenceFor(cohortId)` keeps one store per cohort for the document, like the
Presence Session that feeds it. It outlives the map's mount, so the map draws
everyone again on the way back from the meeting page. It is client state:
never read it while rendering on the server.

## Tests

```bash
pnpm vitest run --project=unit core/presence
pnpm eval:presence
```
