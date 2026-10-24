# Connection Check

Lets a member on the Join Gate test that their camera, microphone and network
reach the media server before Join, using LiveKit's `ConnectionCheck` with a
token from world. This folder holds the request for that token; running the
check and its UI come next.

## Interface

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

## Modules

| Module                        | Owns                                                      |
| ----------------------------- | --------------------------------------------------------- |
| `connection-check.service.ts` | the request and the mapping of world's answer             |
| `media-origin.ts`             | `readMediaOrigin` and `pinMediaUrl`, the media host's pin |

## Tests

```bash
pnpm vitest run --project=unit features/campus/services/connection-check
pnpm eval:privacy
```
