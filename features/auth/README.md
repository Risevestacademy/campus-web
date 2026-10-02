# Auth

Owns the question "may this request render a Campus route?" Route code asks
one function and branches on the answer. Session transport, retries, and
return-destination policy stay behind it.

## Public interface

Import only from `@/features/auth`.

```ts
import { authorizeRoute, normalizeCampusReturnTo } from "@/features/auth";

const decision = await authorizeRoute({
  kind: "campus-shell",
  returnTo: "/campus/42?tab=people",
});
```

| Decision      | Meaning                                                             | Route action                                                             |
| ------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `allow`       | `full_access` session; `session` is the full `SessionResponseDto`   | render                                                                   |
| `redirect`    | provisional, anonymous, or expired session                          | `redirect(decision.href)`                                                |
| `forbidden`   | backend refused the account (403, e.g. suspended)                   | `forbidden()`                                                            |
| `unavailable` | session service down after retries, or returned a malformed session | fail-closed retry state; `retryAfterMs` is the backend hint when present |

`authorizeRoute` is server-only. It reads cookies, so any route that calls it
renders per request.

## Session outcomes

`GET /v1/auth/me` is called directly through `getServerApi()`, never through
the browser `/api` proxy.

| Backend response                   | Session read      | Retried |
| ---------------------------------- | ----------------- | ------- |
| 200 with a valid session           | `authenticated`   | no      |
| 200 with a malformed or empty body | `unavailable`     | no      |
| 401                                | `unauthenticated` | never   |
| 403                                | `forbidden`       | never   |
| network error, 408, 429, 5xx       | `unavailable`     | yes     |
| any other status                   | `unavailable`     | no      |

An outage is never reported as signed out. Malformed bodies count as outages
for the same reason.

Retries: three attempts in total, waiting 200 ms and then 500 ms. A
`Retry-After` header (seconds or HTTP-date) can lengthen a wait up to 2 s; it
never shortens the backoff.

The read is wrapped in React `cache()` with no arguments, so it runs once per
server request however many layouts and pages ask. Nothing is held in module
state or the Next Data Cache.

## Route policy

| Session                                    | Decision                               |
| ------------------------------------------ | -------------------------------------- |
| `full_access`                              | `allow`                                |
| `provisional`                              | redirect `/invitation`                 |
| none, no `campus_refresh_attempted` cookie | redirect `/session/refresh?returnTo=…` |
| none, `campus_refresh_attempted` present   | redirect `/sign-in?returnTo=…`         |

The refresh-attempt marker breaks the refresh/redirect loop: one automatic
refresh per visit, then sign-in. `campus-shell` and `campus-index` share this
policy until the cohort chooser adds index-specific rules.

## Return destinations

`normalizeCampusReturnTo(value)` returns a same-origin `/campus` or
`/campus/**` path with its query, or `/campus` when the value is unsafe. It:

- keeps path and query, drops the fragment;
- percent-encodes the result so it is safe in a `Location` header;
- rejects absolute, protocol-relative, and non-`/campus` destinations;
- rejects literal or percent-encoded `.`/`..` segments, encoded slashes,
  empty interior segments, backslashes, and control characters (raw or
  encoded);
- rejects malformed percent-encoding and values over 2048 characters.

`parseCampusReturnTo(value)` applies the same rules but returns `undefined`
instead of falling back, for callers that must distinguish "no valid
destination" (the OAuth proxy receives it by injection, since `core` cannot
import `features`). Client components never import this module: a Server
Component sanitizes the value and passes it down as a prop.

Dot segments are checked on the raw input. The URL parser resolves them
silently, so `/campus/42/../43` would otherwise look like a clean Campus path.

## Session refresh

`RefreshSession` (client component) renders `/session/refresh`. The route's
Server Component sanitizes `returnTo` with `normalizeCampusReturnTo` and passes
it as a prop. The component follows the project flow:

```text
RefreshSession -> useSessionRefresh -> useMutation -> createSessionRefresher -> browserApi
```

- One automatic POST to `/api/v1/auth/refresh` on mount, never retried by
  TanStack Query (`retry: false`).
- Success replaces history with the destination; 401 replaces it with
  `/sign-in?error=session_expired&returnTo=...`; anything else shows a
  fail-closed retry state.
- Manual retry cooldowns: 1, 2, 4, then 8 seconds. A longer `Retry-After`
  extends a cooldown up to 8 seconds.
- `createSessionRefresher` shares one in-flight POST between concurrent
  callers. The refresh token rotates, so a second POST (for example from React
  StrictMode's double mount in development) would sign the visitor out. Each
  mounted page owns its refresher, so no request state outlives the page.

## Layout

| Path                                | Role                                                            |
| ----------------------------------- | --------------------------------------------------------------- |
| `index.ts`                          | public interface                                                |
| `components/refresh-session.tsx`    | refresh page UI                                                 |
| `hooks/use-session-refresh.ts`      | refresh mutation, outcome handling, cooldown schedule           |
| `hooks/use-countdown.ts`            | retry countdown                                                 |
| `hooks/use-mount-effect.ts`         | the only sanctioned `useEffect` wrapper                         |
| `services/authorization.service.ts` | `authorizeRoute`: server-only, `cache()`, cookies, route policy |
| `services/session.service.ts`       | `/v1/auth/me` read with retries; single-flight refresh POST     |
| `schemas/session.schema.ts`         | validates the session fields route policies depend on           |
| `schemas/return-to.ts`              | Campus return-destination policy                                |
| `types/auth.types.ts`               | public types                                                    |

Client modules import siblings directly, never `index.ts`: the entry point
re-exports the server-only `authorizeRoute`.

## Tests

```bash
pnpm vitest run --project unit features/auth
```

Tests exercise the public interface in `index.ts`. The backend is MSW
(`tests/fixtures/mock-api.ts`), started inside `vi.hoisted` because API clients
capture `fetch` when created; request cookies are a mocked `next/headers`; time
is Vitest fake timers. Components render inside a fresh `QueryClient`
(`tests/fixtures/query-client.tsx`).

React `cache()` is a pass-through outside a server render, so per-request
memoization is verified by the Playwright suite in
`02-campus-route-protection-plan.md`, not here.
