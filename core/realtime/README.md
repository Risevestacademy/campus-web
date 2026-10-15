# Realtime

This directory owns the frontend's contract with `world`, the realtime
service behind the campus map: who is here and where they stand. `world` is
the service; `realtime` is this layer.

There is no socket client yet. Today it holds the generated protocol types
and the parser for inbound frames.

## Interface

```ts
import {
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from "@/core/realtime";
```

- `ServerMessage`, `ClientMessage`, one type per message (`WelcomeMessage`,
  `MoveResultMessage`, …), and `Player`, `Avatar`, `Direction`,
  `MoveOutcome`: generated from world's protocol.
- `parseServerMessage(text)`: one socket frame's text as a `ServerMessage`,
  or `undefined` for anything else (not JSON, an unknown `type`, a field of
  the wrong shape).

## Protocol types

`generated/world-protocol.ts` is generated. Do not edit it. Regenerate with:

```bash
pnpm world:types
```

The command loads `.env.local` and reads `${NEXT_PUBLIC_WORLD_URL}/schema.json`,
the JSON Schema world serves from the code deployed there. Generate against
the environment you build for: one that is ahead of production describes
frames production does not send yet.

```bash
# world from the server repo, run with PORT=8001
NEXT_PUBLIC_WORLD_URL=http://localhost:8001

# the dev deployment
NEXT_PUBLIC_WORLD_URL=https://ws.dev.campusbyrise.com
```

Only HTTPS origins and plain HTTP on loopback are accepted. A
`*.railway.internal` host is refused: the browser opens the socket, and it
cannot resolve Railway's private DNS.

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
- An unknown `type` parses to `undefined`. The socket client should log and
  skip it, not close the socket.

Outbound frames are built from the `ClientMessage` type and need no parser.

## Tests

```bash
pnpm vitest run --project=unit core/realtime
pnpm eval:privacy
```

`contract.typecheck.ts` is checked by `pnpm typecheck`: a message world does
not accept fails compilation.
