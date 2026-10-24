# Connection Check

Lets a member on the Join Gate test that their camera, microphone and network
reach the media server before Join, using LiveKit's `ConnectionCheck` with a
token from world. This folder requests the token and runs the check; the
Join Gate UI comes next.

## Interface

In React, `useConnectionCheck()` (`hooks/use-connection-check.ts`, under
`MediaSessionProvider` and a `QueryClientProvider`) gives:

```ts
const { start, isRunning, steps, result } = useConnectionCheck();
// steps: { network, microphone, camera }: pending | running | passed | failed | skipped
// result: ConnectionCheckResult | undefined, set once a run settles
```

- `start()` reads the member's live tracks at the click; a second start while
  one runs is ignored. Every run asks world for a new token.
- Steps run network → microphone → camera and stop at the first failure.
  `result` is `passed`, `step-failed` with the step, or the refusal from world
  below. A run that throws (the SDK chunk failed to load) reads `failed`.
- Unmounting aborts the run. The SDK cannot cancel a step in flight, so the
  abort lands between steps: the current step (at most about 4 s) finishes,
  disconnects itself, and its result is dropped.

### Steps

- **network:** LiveKit's `checkWebsocket`, `checkWebRTC`, `checkTURN`, in
  order. `SKIPPED` counts as passed; a server without TURN only warns.
- **microphone, camera:** a `Checker` subclass run through
  `ConnectionCheck.createAndRunCheck` publishes a **copy** of the member's
  live track, waits 3 s and needs `packetsSent > 0`. The SDK's own
  `checkPublishAudio/Video` are not used: they open the default device, open
  the camera even when the member turned it off, and open a second handle on
  devices the preview holds. A source that is off is `skipped`, never opened.
  The copy is stopped; the member's track never is.

### The token request

```ts
const access = await requestConnectionCheck(
  {
    fetch,
    worldOrigin, // readWorldOrigin(publicEnvironment)
    mediaOrigin, // readMediaOrigin(publicEnvironment)
  },
  signal, // optional: an abort rejects, everything else resolves
);
```

`POST ${worldOrigin}/media/connection-check` goes to world directly, not
through `/api`, with `credentials: "include"` and no body. The spec is
"The connection check" in world's README.

| world answers                       | `access.kind`                       |
| ----------------------------------- | ----------------------------------- |
| (`NEXT_PUBLIC_MEDIA_URL` unset)     | `unavailable`, and nothing is asked |
| 200 with a token for the pinned URL | `ready` with `url` and `token`      |
| 200 otherwise                       | `failed`                            |
| 401                                 | `signed-out`                        |
| 403                                 | `misconfigured`                     |
| 429                                 | `rate-limited`, `retryAfterSeconds` |
| 503 `MEDIA_NOT_CONFIGURED`          | `unavailable`                       |
| any other status, or no answer      | `failed`                            |

- **Pinned host.** The `url` comes from data, so it is handed back only when
  its origin equals `NEXT_PUBLIC_MEDIA_URL`. Set that variable to world's
  `LIVEKIT_URL` in each deployment. A mismatch makes every check `failed`.
- **Hand-written schema.** world publishes no HTTP schema for this route
  (its `/docs-json` covers the socket only), so
  `schemas/connection-check.schema.ts` is not bound with `z.toZod`. Bind it
  once world publishes one. Only `url` and `token` are kept; `room` and
  `expiresAt` are dropped because nothing reads them.
- **One token per run.** A token lasts two minutes and serves one check. Ask
  again for every run; never cache `ready`.
- **No answer reads as `failed`.** The browser reports a CORS refusal and
  being offline as the same error, so neither can be named more precisely.
- **The token is a credential.** It never reaches a log, an analytics
  property or an error message.

## Join Gate UI

`ConnectionCheck` (`components/connection-check.tsx`) sits between the camera
preview and Join on the Join Gate. It renders nothing when the build has no
`NEXT_PUBLIC_MEDIA_URL`, and shares no state with Join, so it never blocks it.

- `ConnectionCheckPanel` renders the button, the step list and a
  `role="status"` region. The region stays mounted and never `display: none`,
  so the first result is announced. Stories: one per state.
- `connection-check-feedback.ts` maps each result to plain words and one
  hint. The copy never names a LiveKit check.
- A 503 hides the button and says calls are unavailable. A rate limit shows
  the seconds to wait with no countdown; an early press gets a fresh 429.
- A 401 reads "couldn't run the test", never a sign-in redirect: `CohortGate`
  already proved the session, so the cookie is not reaching world.

## Modules

| Module                        | Owns                                                       |
| ----------------------------- | ---------------------------------------------------------- |
| `connection-check.service.ts` | the request and the mapping of world's answer              |
| `media-origin.ts`             | `readMediaOrigin` and `pinMediaUrl`, the media host's pin  |
| `run-connection-check.ts`     | step order, skipping, stopping, abort between steps (pure) |
| `livekit-probe.ts`            | the only module that loads `livekit-client`, by `import()` |
| `check-connection.ts`         | token first; the SDK loads only for `ready`                |
| `browser-connection-check.ts` | browser bindings: `publicEnvironment`, `fetch`, the SDK    |

`livekit-client` is about 150 KB gzipped. Lint rejects any value import of it
(`config/livekit-imports.json`); type imports and `import()` are allowed, so it
never enters the Join Gate's first load. Tests use `testing/fake-livekit.ts`.

## Tests

```bash
pnpm vitest run --project=unit \
  features/campus/services/connection-check \
  features/campus/hooks/use-connection-check.test.tsx \
  tests/architecture/livekit-imports.test.ts
pnpm eval:privacy
```
