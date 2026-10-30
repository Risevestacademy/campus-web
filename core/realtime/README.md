# Realtime

This directory owns the frontend's contract with `world`, the realtime
service behind the campus map: who is here and where they stand. `world` is
the service; `realtime` is this layer.

It holds the generated protocol types, the parser for inbound frames, the
policy for a closed socket, and the socket client that applies all three.

## Interface

```ts
import {
  classifyClose,
  createRealtimeClient,
  movementFor,
  parseServerMessage,
  parseSocketClose,
  reconnectDelay,
  type ClientMessage,
  type ServerMessage,
  type WorldMovement,
  type WorldCloseCode,
  type WorldCloseReason,
} from "@/core/realtime";
```

- `ServerMessage`, `ClientMessage`, `WorldCloseCode`, `WorldCloseReason`, one
  type per message (`WelcomeMessage`, `MoveResultMessage`, …), and `Player`,
  `Avatar`, `Direction`, `MoveOutcome`, `ErrorCode`: derived from world's
  generated protocol. `Avatar`, `WelcomeMessage`, `SnapshotMessage` and
  `JoinedMessage` keep only the fields a feature reads. `MoveOutcome` and
  `ErrorCode` also hold `"unknown"` (see Inbound frames).
- `parseServerMessage(text)`: one socket frame's text as a
  `ServerMessageResult`; see [Inbound frames](#inbound-frames).
- `parseSocketClose(code, reason)`: a close event's fields, bounded to the
  registered code range (1000-4999) and a 123-byte UTF-8 reason. Anything
  outside becomes `{ code: 0, reason: "" }`; each field is judged alone, so
  an unusable reason never erases a readable code.
- `classifyClose({ code, reason })` and `reconnectDelay(attempt, random)`:
  what to do when the socket closes; see [Close policy](#close-policy).
- `createRealtimeClient(options)`: one cohort's socket, from connect to the
  last retry; see [Socket client](#socket-client).
- `movementFor(cohortId)`: one cohort's `WorldMovement` port. It accepts
  movement only after `welcome` and `snapshot`, exposes world's `stepMs`, and
  sends typed `move` frames through the current admitted socket.
- `browserIsOnline()` and `subscribeToBrowserWake(listener)` in
  `browser-lifecycle.ts`: the browser's online state and its wake signals
  (`online`, the tab becoming visible or focused, a page restored from the
  back-forward cache). Whoever composes the client passes them as ports so
  tests can drive the same lifecycle; see [Socket client](#socket-client).
- `readWorldSocketUrl(environment, cohortId)` in `configuration.ts`: the
  socket's `wss://<world>/socket?cohortId=…` (`ws://` on loopback).

## Protocol types

`generated/world-protocol.ts` is generated. Do not edit it. Regenerate with:

```bash
pnpm world:types
```

The command loads `.env.local` and reads `${NEXT_PUBLIC_WORLD_URL}/schema.json`,
the JSON Schema world serves from the code deployed there. Generate against
the environment you build for: one that is ahead of production describes
frames production does not send yet.

The generated file starts with the sha256 of the schema it was built from.
world serves its committed `apps/world/protocol.schema.json` byte for byte,
so the hash names the campus-server commit. A hash that matches no commit on
campus-server's `dev` came from an unmerged branch: regenerate before
committing. The fetch gives up after 10 seconds.

```bash
git -C <campus-server> show origin/dev:apps/world/protocol.schema.json \
  | shasum -a 256
```

```bash
# world from the server repo, run with PORT=8001
NEXT_PUBLIC_WORLD_URL=http://localhost:8001

# the dev deployment: the staging value set on campus-web in Railway
NEXT_PUBLIC_WORLD_URL=https://<dev world host>
```

Only HTTPS origins and plain HTTP on loopback are accepted. A
`*.railway.internal` host is refused over any protocol: the browser opens the
socket, and it cannot resolve Railway's private DNS.

`readWorldOrigin` takes the environment as an argument. Browser code passes
`publicEnvironment` from `config/environment/public.ts`, because Next only
inlines a literal `process.env.NEXT_PUBLIC_WORLD_URL`.

The schema is draft-07 JSON Schema. The generator wraps its `definitions` in
an OpenAPI 3.1 document so the `openapi-typescript` that builds the Campus
API types builds these too, with no second generator.

What a client must _do_ (message order, predicting and correcting a step,
close codes, reconnecting) is not in the schema. It lives in the server
repo's `docs/world-protocol.md`, and every world instance renders the
protocol at `/docs`.

## Inbound frames

A frame from the socket is untrusted input, like an API response. Parse each
frame once with `parseServerMessage` where it arrives and read only the
result.

- Every message schema in `server-message.schema.ts` is bound with `z.toZod`
  to its generated type, or to a `Pick` of the fields a feature reads. A read
  field removed or reshaped upstream fails `pnpm typecheck` there after
  `pnpm world:types`. A field world adds is dropped until a feature reads it;
  reading one widens the `Pick` and the world frame allow-list in
  `tests/evals/data-privacy.eval.test.ts`.
- `contract.typecheck.ts` pins `ServerMessage`'s types to the generated
  union, so a message added, removed or renamed upstream fails
  `pnpm typecheck` until it has a schema.
- Messages no feature reads yet (`lockChanged`, `lockableSpaces`,
  `broadcast`, `said`, `entryRequested`, `entryRequestEnded`, `staffAction`,
  `walking`, `walkEnded`) parse to `{ type }` alone. They are known, so they
  are not logged as skipped, and nothing unread travels on: `broadcast`'s
  media token is dropped with the rest. The feature that reads one gives it a
  real schema.
- `snapshot.spaces` and the `spaces` frame keep each space's `spaceKey` and
  `name`.
- `call` keeps `url` and `token` (both non-empty), `hearing` and
  `audibleRadius` (non-negative);
  `call: null` means no call. `room` and `subscribeRadius` are stripped: the
  token already names the room. A `hearing` world added later reads as
  `"unknown"`.
  The token is a media secret: proximity audio holds it only for the join
  that uses it.
- Objects strip unknown fields rather than reject them. The schema's
  `additionalProperties: false` describes what world sends today, not a
  promise that it will never add a field.
- `z.toZod` cannot see bounds. Tiles are non-negative safe integers; the
  tests cover that.
- An `outcome` or error `code` string world added after the last
  `pnpm world:types` reads as `"unknown"`, so a `moveResult` still answers its
  move. The value world sent is dropped. `MoveOutcome` and `ErrorCode` are the
  generated unions plus `"unknown"`, so a value `pnpm world:types` adds fails
  `pnpm typecheck` until the schema's list names it. Outcomes are listed in
  `move-outcomes.ts`; adding a correction there also adds it to
  `campus_world.move_corrected`, and the analytics contract eval pins that
  list, so the change shows up in review. `Direction` stays closed:
  a new direction breaks the grid model and needs a client release.
- `parseServerMessage` returns `{ ok: true, message }` or a failure:
  - `{ reason: "unknown-type" }`: a message world added after the last
    `pnpm world:types`. Log it and skip it; never close the socket.
  - `{ reason: "invalid", type }`: a known message that failed to parse. A
    fault, not noise: a corrupted `welcome` or `snapshot` would otherwise
    leave the client waiting forever.
  - `{ reason: "invalid" }` with no `type`: not JSON, or no string `type`.

  A failure never carries the frame's text, so nothing unparsed reaches logs.

Outbound frames are built from the `ClientMessage` type and need no parser.

## Close policy

`classifyClose({ code, reason })` turns a close event into one
`CloseAction`, one row per line of the close table in the server repo's
`docs/world-protocol.md`:

| Close                                                       | `CloseAction`             |
| ----------------------------------------------------------- | ------------------------- |
| 1008 `no_token`, `session_revoked`                          | `sign-in`                 |
| 1008 `token_not_usable`, `session_expired`, `session_ended` | `reconnect-after-refresh` |
| 1008 `wrong_scope`                                          | `onboarding`              |
| 1008 `account_suspended`, `account_gone`                    | `sign-out`                |
| 1008 `not_a_member`                                         | `choose-cohort`           |
| 1008 `origin_not_allowed`, `no_cohort`                      | `stop`                    |
| 1008 `rate_limited`                                         | `reconnect`               |
| 4000, whatever the reason                                   | `entered-elsewhere`       |
| 1001, 1006, 1009, 1011                                      | `reconnect`               |
| 1008 with a reason not listed                               | `stop`                    |
| any other code                                              | `stop`                    |

- Only a 1008's reason is read, and it must match exactly. Every other code
  decides alone, so 4000 never reconnects, whatever reason it carries: two
  tabs that both reconnected would replace each other forever.
- An undocumented code stops instead of reconnecting. World never sends one;
  a code nothing documents is a decision the socket client cannot make, and
  retrying it would only hide the gap between world and this table.
- `CLOSE_REASONS` lists every reason a reported close can carry, world's and
  the client's own; `isCloseReason` checks one. Analytics sends a reason only
  from this list, anything else as `unknown`.
- World's close codes and reasons come from the generated protocol. The local
  runtime lists are checked exhaustively against those unions, so an upstream
  addition, removal or rename fails type checking until its policy is decided.
  Browser 1006, socket-library 1009 and the client's own closes remain local.

`reconnectDelay(attempt, random)` is the wait before the `attempt`th
reconnect in a row (from 1), given a `random` in [0, 1) the caller draws. The
ceiling starts at 1 s and doubles up to 16 s; the delay is half the ceiling
plus a random share of the other half. Even at the slowest draw, the first
four attempts start within 15 s, half of world's 30 s grace, so a blip
resumes where the member stood. No delay is under 500 ms.

## Socket client

```ts
const client = createRealtimeClient({
  url: readWorldSocketUrl(publicEnvironment, cohortId),
  createSocket: (url) => new WebSocket(url),
  logger,
  onEvent,
  refreshSession,
  isOnline: browserIsOnline,
  subscribeToWake: subscribeToBrowserWake,
});

client.connect();
useSyncExternalStore(client.subscribe, client.getStatus);
```

`WorldSession` binds the cohort's movement channel to this client. A close
disables sending immediately. The next `welcome` and `snapshot` re-enable it,
so reconnect state always starts from world's authoritative snapshot.

Features never construct a `WebSocket`; whoever composes the client passes
`createSocket`. `isOnline` and `subscribeToWake` are optional ports: without
them the client assumes it is always online. `onEvent` receives, in order:

| Event                           | When                                                    |
| ------------------------------- | ------------------------------------------------------- |
| `message {message}`             | every frame that parsed, `welcome` and `snapshot` too   |
| `connected {attempt}`           | both `welcome` and `snapshot` arrived; 0 is the first   |
| `closed {code, reason, action}` | every close but `close()`'s own, with its `CloseAction` |
| `stopped {outcome, attempts}`   | once per terminal outcome; nothing retries after it     |

`getStatus()` is `idle`, `connecting {attempt}`, `connected`, `reconnecting
{attempt}` or `closed {outcome}`. It is the same object until it changes.

- **Frames.** Each is parsed once. An unknown type, a frame with no type,
  text that is not JSON and binary data are logged as
  `realtime.frame_skipped {reason}` and skipped. A known type that fails is
  logged as `realtime.frame_invalid {type}` and skipped, unless it is the
  `welcome` or `snapshot` still awaited. No log record carries frame text.
- **Handshake.** `welcome` and `snapshot` must both arrive within 10 s of
  creating the socket, which also covers an upgrade that never opens. An
  invalid one closes with 4001 `invalid_handshake`, a late one with 4002
  `handshake_timeout`. Both are reported as `closed` and retried.
- **Liveness.** `welcome`'s `heartbeatSeconds` sets the interval. Each tick
  the client sends `ping`; if the previous `pong` never came, the connection
  is presumed dead and closed with 4003 `liveness_timeout`, then retried.
  This catches half-open sockets a close event never reaches.
- **Replacement.** A `replaced` frame means world has admitted the same
  member elsewhere. The client stops at once with `entered-elsewhere` and
  closes its socket; the close frame that follows (4000, or a lost frame's
  abrupt 1006) is swallowed, because the outcome is already terminal. Never
  reconnecting is what stops two tabs from replacing each other forever.
- **Retries.** `reconnect` waits `reconnectDelay(attempt)` and connects again.
  `reconnect-after-refresh` calls `refreshSession` first: `refreshed`
  schedules the retry, `expired` stops with `sign-in`, and `failed` waits
  out `retryAfterMs` (never under `reconnectDelay`) and calls again. Both
  count toward the cap: after 10 attempts in a row it stops with `gave-up`.
  The count resets only once a socket stays open 60 s; resetting on
  `snapshot` would let a `rate_limited` or 1009 loop retry at the first
  delay forever.
- **Offline.** While `isOnline()` is false, scheduled retries are dropped
  instead of started: the browser may kill timers in its sleep, and burning
  the 10-attempt budget while offline would turn a doze into a `gave-up`.
  The client holds the pending operation in `reconnecting` until the machine
  wakes. A refresh remains a refresh; waking never bypasses it with a socket.
- **Wake.** On a wake signal (`online`, the tab becoming visible or
  focused, a page restored from the back-forward cache), the client probes a
  connected socket immediately. A missed pong follows the normal close and
  retry path, so a healthy wake never creates a second socket or resets the
  retry budget. A waiting connect or refresh starts at once instead of waiting
  out the backoff. `gave-up` resumes the operation that exhausted its budget.
  Terminal outcomes (`entered-elsewhere`, `sign-in`, …) are never woken.
- **Terminal actions** stop with their outcome. `entered-elsewhere` never
  reconnects on its own.
- **`connect()`** does nothing while a socket is live or a retry is
  scheduled. From `closed` it is the member's own reconnect ("Use here",
  "Reconnect"): it connects at once, counts as attempt 1, and starts a fresh
  budget.
- **`send(message)`** writes one JSON frame while the socket is open and
  returns `false` otherwise. Nothing is queued, so no move outlives a drop.
- **`close()`** ends the socket with 1000 `presence_ended`, cancels any retry
  or refresh in flight, and returns to `idle`. It reports no `closed`.

A socket the client closes itself loses its listeners first, so its echoed
close is never read: one close is reported once, and a dead socket cannot
start a second one.

`createJsonLogger` writes to `process.stdout`; in the browser, pass
`createConsoleLogger()` from `core/observability`.

## Tests

```bash
pnpm vitest run --project=unit core/realtime
pnpm eval:privacy
pnpm eval:realtime
pnpm exec playwright test tests/e2e/realtime.spec.ts
```

The client's tests and eval drive it against msw's `ws.link`
(`tests/fixtures/mock-world.ts`) with vitest's fake timers; msw delivers
socket events in microtasks, which fake timers leave running.

The Playwright spec replaces world with `routeWebSocket` and verifies the
browser lifecycle from server frames through the campus map and terminal
Presence Session outcomes.

`contract.typecheck.ts` is checked by `pnpm typecheck`: a message world does
not accept fails compilation.
