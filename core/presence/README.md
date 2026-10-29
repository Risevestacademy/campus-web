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
- `map`: the authoritative world map — its id, version and tile width and
  height — from `snapshot`. The map renderer loads art for exactly this
  map, so everyone sees the same layout world enforced, not a default the
  bundle shipped.
- `participants`: who is here, `Map<userId, { userId, displayName, spriteKey,
status, spaceKey }>`. `status` is `available`, `busy`, `away` (or `unknown`
  for a value world adds later) and `spaceKey` names the space they stand in,
  `_default` for the corridors and grounds. Room names are not kept yet.
- `positions`: where they stand, `Map<userId, { x, y, facing }>` in tiles,
  clamped into the map's bounds.
- `nearby`: the `userId`s world says are close enough to hear you, once each,
  in the order they came near. World sends its list sorted; keeping arrival order
  means a newcomer never reshuffles whoever was already there.
- `encounter`: how many times somebody came near after nobody was. A view
  opened during one encounter (the meeting grid) checks it, so it does not
  reopen by itself when the next one starts.

They are separate maps so React can subscribe to who is here without
rendering on every `moved` tick. A `spaceChanged` does replace the person's
entry, since it is the one movement the roster shows. KAPLAY reads `positions` each frame and
keeps anything finer (pixels, walking) itself.

| Message         | participants              | positions                  |
| --------------- | ------------------------- | -------------------------- |
| `welcome`       | (sets `selfId`)           |                            |
| `snapshot`      | replaced                  | replaced, with the map     |
| `joined`        | set, replacing any entry  | set                        |
| `appearance`    | name and sprite updated   |                            |
| `statusChanged` | status updated if present |                            |
| `spaceChanged`  | space updated if present  |                            |
| `left`          | removed                   | removed                    |
| `moved`         |                           | updated for known ids      |
| `moveResult`    |                           | yours, from world's answer |

`nearby` changes only `nearby` (and `encounter` when it goes from empty to
not). It can name somebody not in `participants` yet; readers skip them
until `joined` arrives.

- A `snapshot` replaces every field above rather than patching them. After a
  reconnect, patching would keep whoever left while the socket was down.
- Positions outside the map are clamped, not rejected: world is trusted, and
  a stale tile index should draw at the edge, not break the frame.
- `encounter` is the one field a `snapshot` keeps, so it never repeats in a
  session. World sends a fresh `nearby` after a reconnect.
- `clearRemoteParticipants()` keeps you (`selfId`) and the map, and drops
  everyone else, `nearby` included. Every recoverable close calls it, so a
  drop never leaves frozen stand-ins mid-pose; `clear()` removes everything.
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
