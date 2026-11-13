# Presence

Who is in a cohort's campus, and where world last placed them. It is applied
from the realtime client's messages and read by the campus map (and, later,
the roster). It never parses a frame: `core/realtime` already did.

## Interface

```ts
import {
  applyServerMessage,
  createPresenceStore,
  type Hearing,
  hearingOf,
  presenceFor,
  type Presence,
  spaceNameOf,
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
- `synced`: true from a `snapshot` until the socket closes. `map` outlives a
  closed socket so the scene stays drawn, so read `synced`, not `map`, to
  know whether who is online is current.
- `participants`: who is here, `Map<userId, { userId, displayName, spriteKey,
status, statusUntil, spaceKey }>`. `status` is `available`, `busy`, `away` (or `unknown`
  for a value world adds later); `statusUntil` is when a status chosen for a
  while ends, or null; `spaceKey` names the space they stand in,
  `_default` for the corridors and grounds. `statusTimeLeft(statusUntil, now)`
  words what is left, to the nearest minute.
- `positions`: where they stand, `Map<userId, { x, y, facing }>` in tiles,
  clamped into the map's bounds.
- `spaceNames`: what each space is called, `Map<spaceKey, name>`, from
  `snapshot` and replaced whole by `spaces` when one is renamed. Read it with
  `spaceNameOf(presence, spaceKey)`, which shows the key for a space World has
  not named, as World does.
- Locks: `ownSpaceKeyOf(presence)` is the space you stand in,
  `isSpaceLocked(presence, spaceKey)` reads `lockedSpaces`, and
  `refusedEntryNotice(presence, spaceKey)` words a refusal ("Room 1 is
  locked" or "Room 1 is private"), since a refused step looks the same for a
  locked space and a designated one whose list does not name you. `claimEntryRefusals(cohortId)` is held
  by the mounted map, which answers refusals itself; while nothing holds it,
  `entryRefusalsClaimed` is false and walk feedback says a refused walk.
- `nearby`: the `userId`s world says are close enough to hear you, once each,
  in the order they came near. World sends its list sorted; keeping arrival order
  means a newcomer never reshuffles whoever was already there.
- `hearing`: how World's `call` for your space hears, `room` or `proximity`;
  `null` after `call: null` or a hearing World added later. After your own
  step into another space, or a `snapshot`, a held call becomes `awaiting`
  until World sends the space's next one: World mints that token after the
  frame, and the old call says nothing about the new space. Only the hearing
  is kept, never the call's token. `hearingOf(call)` is the one rule for
  which calls are heard; the audio session uses it too.
- `meetingRoster`: who you meet, in the order they arrived, without you.
  Under `room` hearing it is everyone presence knows in your space; while
  `awaiting` it is nobody; otherwise it is whoever `nearby` names that
  presence knows in your space. World's `nearby` lags a crossing by a tick,
  and the call that ends `awaiting` usually arrives first, so the space check
  keeps the old space's people out. World names nobody near in a room space,
  so falling back to `nearby` is safe. A World without media sends neither
  `call` nor `nearby`, so its roster stays empty.
- `encounter`: how many times somebody joined `meetingRoster` after nobody
  was. A view opened during one encounter (the meeting grid) checks it, so it
  does not reopen by itself when the next one starts.

They are separate maps so React can subscribe to who is here without
rendering on every `moved` tick. A `spaceChanged` does replace the person's
entry, since it is the one movement the roster shows. KAPLAY reads `positions` each frame and
keeps anything finer (pixels, walking) itself.

| Message             | participants                | positions                    |
| ------------------- | --------------------------- | ---------------------------- |
| `welcome`           | (sets `selfId`)             |                              |
| `snapshot`          | replaced, with `spaceNames` | replaced, with the map       |
| `joined`            | set, replacing any entry    | set                          |
| `appearance`        | name and sprite updated     |                              |
| `statusChanged`     | status and end updated ²    |                              |
| `spaceChanged`      | space updated if present ¹  |                              |
| `left`              | removed                     | removed                      |
| `moved`             |                             | updated for known ids        |
| `moveResult`        |                             | yours, from world's answer   |
| `walking`           |                             | yours, each step of a walk   |
| `walkEnded`         |                             | yours, where the walk ended  |
| `positionCorrected` |                             | yours, where world moved you |
| `spaces`            | (replaces `spaceNames`)     |                              |
| `call`              | (sets `hearing`)            |                              |

¹ Your own `spaceChanged` into another space sets a held `hearing` to
`awaiting`, and the roster is empty until World's next `call`. Otherwise
stepping out of a room would meet the whole corridor, and stepping into one
would keep the corridor's `nearby` until World's next tick.

² World answers your own `setStatus` only when the cohort sees a change, so
`drawOwnStatus(status, statusUntil)` on the store draws your choice at once,
and the `statusChanged` that follows, if any, settles it.

### What the campus says and decides

`social.ts` holds the frames about talking, knocking, locking and staff, beside
the map state above. `Presence` extends its `Social` fields:

| Message             | Field                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| `snapshot`          | `lockableSpaces` and `lockedSpaces` replaced, `entryRequests` emptied |
| `lockableSpaces`    | `lockableSpaces` replaced                                             |
| `lockChanged`       | `lockedSpaces`: the space added or removed                            |
| `said`              | `chat`: the newest 200 lines, a repeated `id` ignored                 |
| `entryRequested`    | `entryRequests`: open, keyed by `requestId`                           |
| `entryRequestEnded` | out of `entryRequests`, into `entryOutcomes` (newest 20)              |
| `staffAction`       | `staffActions`: the newest 10, each with a running `seq`              |
| `error`             | `errors`: the newest 10, each with a running `seq`                    |
| `broadcast`         | `broadcast`: the room and whether you may speak in it, or null        |
| `desksChanged`      | `desksVersion` + 1: the cue to fetch the desks again                  |

- World keeps no history, so a reconnect's `snapshot` keeps `chat`,
  `entryOutcomes` and `staffActions` (what the member has already seen) and
  replaces the locks.
- Open requests were sent to a socket, so they end with it: a `snapshot` and
  `clearRemoteParticipants()` both empty `entryRequests`, since no frame says
  so when a socket closes.

- World's refusals carry no id of the action they answer. The campus shell
  shows each one (`world-error-feedback.ts` in the world session). A feature
  that sent an action and wants its own answer reads `errors` after sending,
  and tells a new one by `seq`.
- `broadcast` keeps only the room and `canSpeak`. The call's url and token
  never enter presence, as a space's call token does not: they reach the media
  session through the world session's `onMessage`, which gets every parsed
  frame. A frame whose call cannot be read is dropped, not read as null,
  because null means leave the room.
- A closed socket takes the member out of the broadcast room, so
  `clearRemoteParticipants()` sets `broadcast` to null along with the open
  requests. World sends the broadcast again on arrival.
- `desksVersion` and every `seq` (`staffActions` and `errors`) start again from
  0 after `clear()`. A view that keeps "the last one I showed" must keep it in
  state that is cleared with presence, or it will show an old action again.

`nearby` changes only `nearby`. It can name somebody not in `participants`
yet; the roster skips them until `joined` arrives.

`meetingRoster` and `encounter` are recomputed after every message, in one
wrapper around the reducer. It keeps the same array when nobody changed, so
a `moved` tick never hands React a new roster.

- A `snapshot` replaces every field above rather than patching them. After a
  reconnect, patching would keep whoever left while the socket was down.
- Positions outside the map are clamped, not rejected: world is trusted, and
  a stale tile index should draw at the edge, not break the frame.
- A `snapshot` keeps `encounter`, so it never repeats in a session, and
  sets a held `hearing` to `awaiting`: World sends the space's `call` right
  after every `snapshot`. World sends a fresh `nearby` after a reconnect.
- `clearRemoteParticipants()` keeps you (`selfId`), the map, the space
  names and `hearing`, and drops everyone else, `nearby` and
  `meetingRoster` included. Every recoverable close calls it, so a
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
