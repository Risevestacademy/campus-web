# Realtime

This directory owns the frontend's contract with `world`, the realtime
service behind the campus map: who is here and where they stand. `world` is
the service; `realtime` is this layer.

There is no socket client yet. Today it holds the generated protocol types,
the parser for inbound frames, and the policy for a closed socket.

## Interface

```ts
import {
  classifyClose,
  parseServerMessage,
  reconnectDelay,
  type ClientMessage,
  type ServerMessage,
} from "@/core/realtime";
```

- `ServerMessage`, `ClientMessage`, one type per message (`WelcomeMessage`,
  `MoveResultMessage`, …), and `Player`, `Avatar`, `Direction`,
  `MoveOutcome`, `ErrorCode`: generated from world's protocol. `MoveOutcome`
  and `ErrorCode` also hold `"unknown"` (see Inbound frames).
- `parseServerMessage(text)`: one socket frame's text as a
  `ServerMessageResult`; see [Inbound frames](#inbound-frames).
- `classifyClose({ code, reason })` and `reconnectDelay(attempt, random)`:
  what to do when the socket closes; see [Close policy](#close-policy).

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

- Every message schema in `server-message.schema.ts` is bound to its
  generated type with `z.toZod`, so a message added, removed or reshaped
  upstream fails `pnpm typecheck` there after `pnpm world:types`.
- Objects strip unknown fields rather than reject them. The schema's
  `additionalProperties: false` describes what world sends today, not a
  promise that it will never add a field.
- `z.toZod` cannot see bounds. Tiles are non-negative safe integers; the
  tests cover that.
- An `outcome` or error `code` string world added after the last
  `pnpm world:types` reads as `"unknown"`, so a `moveResult` still answers its
  move. The value world sent is dropped. `MoveOutcome` and `ErrorCode` are the
  generated unions plus `"unknown"`, so a value `pnpm world:types` adds fails
  `pnpm typecheck` until the schema's list names it. `Direction` stays closed:
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
| any other code                                              | `reconnect`               |

- Only a 1008's reason is read, and it must match exactly. Every other code
  decides alone, so 4000 never reconnects, whatever reason it carries: two
  tabs that both reconnected would replace each other forever.
- The codes and reasons in `close-codes.ts` are copied by hand from world's
  `apps/world/src/socket/`. They are not in the published schema, so no test
  can pin them to the server. A reason world renames lands on `stop`.

`reconnectDelay(attempt, random)` is the wait before the `attempt`th
reconnect in a row (from 1), given a `random` in [0, 1) the caller draws. The
ceiling starts at 1 s and doubles up to 16 s; the delay is half the ceiling
plus a random share of the other half. Even at the slowest draw, the first
four attempts start within 15 s, half of world's 30 s grace, so a blip
resumes where the member stood. No delay is under 500 ms.

## Tests

```bash
pnpm vitest run --project=unit core/realtime
pnpm eval:privacy
pnpm eval:realtime
```

`contract.typecheck.ts` is checked by `pnpm typecheck`: a message world does
not accept fails compilation.
