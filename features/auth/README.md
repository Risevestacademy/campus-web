# Auth

Owns the question "may this request render a Campus route?" Route code asks
one function and branches on the answer. Session transport, retries, and
return-destination policy stay behind it.

## Public interface

Route code imports from `@/features/auth`. The root `proxy.ts` imports from
`@/features/auth/proxy` instead (see [Root proxy](#root-proxy)).

```tsx
import {
  CampusShellGate,
  requireRouteAccess,
  SessionUnavailable,
} from "@/features/auth";

// Layouts and pages that only need "may this render?"
<CampusShellGate>{children}</CampusShellGate>;

// Pages that need the session
const access = await requireRouteAccess({ kind: "campus-index" });
if (access.kind === "unavailable") {
  return <SessionUnavailable retryHref={access.retryHref} />;
}
access.session; // full SessionResponseDto
```

`requireRouteAccess` turns `redirect` into Next's `redirect()` and `forbidden`
into `forbidden()`, and returns only `allow` or `unavailable`.
`authorizeRoute(request)` returns the raw decision for callers that act on it
differently:

| Decision      | Meaning                                                              | Route action                                                                           |
| ------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `allow`       | the session may render the route; `session` is the full DTO          | render                                                                                 |
| `redirect`    | provisional, anonymous, expired, or a one-cohort member at `/campus` | `redirect(decision.href)`                                                              |
| `forbidden`   | backend refused the account (403), or a member with no cohort        | `forbidden()`                                                                          |
| `unavailable` | session service down after retries, or returned a malformed session  | `SessionUnavailable` linking to `retryHref`; `retryAfterMs` is the backend hint if any |

Requests are `{ kind: "campus-shell" }` or `{ kind: "campus-index" }`. The
return destination comes from the root proxy, not the caller (layouts cannot
see the URL). Everything here is server-only and reads request headers, so any
route that uses it renders per request.

Every `/campus/**` page checks access itself as well as the `(app)` layout:
layouts keep their state across soft navigation and would not run again.
`cache()` keeps that to one `GET /v1/auth/me` per request.

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

Retries: three attempts in total, waiting 200 ms and then 500 ms. Each attempt
is abandoned after 3 s and counts as a network error, so a hung backend fails
closed within 9.7 s instead of blocking the render.

Each attempt calls `fetch(request, { signal })`. Next deduplicates identical
GETs made during one render and only skips that when `fetch` receives a signal
in its second argument; openapi-fetch passes just a `Request`, so without this
every retry would replay the first response and never reach the network. Only
a real server render dedupes, so the Playwright outage test (three backend
hits) is the regression check.

A `Retry-After` header (seconds or HTTP-date) of up to 2 s lengthens the wait;
it never shortens the backoff. A longer one stops the retries at once and
returns `unavailable` with that `retryAfterMs`, so the backend is never asked
again sooner than it requested.

The read is wrapped in React `cache()` with no arguments, so it runs once per
server request however many layouts and pages ask. Nothing is held in module
state or the Next Data Cache.

## Route policy

`services/route-policy.ts` holds the policy as pure functions shared by the
root proxy and `authorizeRoute`.

| Session                             | `campus-shell`                         | `campus-index` (`/campus`)         |
| ----------------------------------- | -------------------------------------- | ---------------------------------- |
| `full_access`, system admin         | `allow`                                | `allow` (admin chooser)            |
| `full_access`, 2+ memberships       | `allow`                                | `allow` (membership chooser)       |
| `full_access`, exactly 1 membership | `allow`                                | redirect `/campus/{cohortId}/join` |
| `full_access`, no memberships       | `allow`                                | `forbidden`                        |
| `provisional`                       | redirect `/invitation`                 | redirect `/invitation`             |
| none, refresh not yet attempted     | redirect `/session/refresh?returnTo=…` | same                               |
| none, refresh already attempted     | redirect `/sign-in?returnTo=…`         | same                               |

The refresh-attempt marker breaks the refresh/redirect loop: one automatic
refresh per visit, then sign-in. A pending `inviteId` does not block a
`full_access` member.

## Root proxy

`guardCampusRequest` (exported from `@/features/auth/proxy`) runs for
`/campus/**` from the root `proxy.ts`. It checks cookie presence only and never
calls the backend:

- no `campus_session`: redirect through refresh, or to sign-in once
  `campus_refresh_attempted` is present;
- `campus_session` present: pass through, writing two request headers the
  render reads (`services/campus-request-headers.ts`). Client-supplied values
  are overwritten or removed:

  | Header                       | Value                                            |
  | ---------------------------- | ------------------------------------------------ |
  | `x-campus-return-to`         | sanitized `pathname + search`                    |
  | `x-campus-refresh-attempted` | `1` when the marker cookie came with the request |

- the marker cookie is deleted on the first `/campus/**` response.

The render reads the marker from the header, not the cookie: Next copies
cookies the proxy sets or deletes into `cookies()` for the same request, so
after the deletion the cookie no longer says whether a refresh happened.

`@/features/auth/proxy` exists because `index.ts` also exports client and
server-only modules, which do not belong in Next's proxy bundle.

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

| Path                                 | Role                                                            |
| ------------------------------------ | --------------------------------------------------------------- |
| `index.ts`                           | public interface for routes                                     |
| `proxy.ts`                           | public interface for the root `proxy.ts`                        |
| `components/campus-shell-gate.tsx`   | renders children only when the visitor may enter Campus         |
| `components/session-unavailable.tsx` | fail-closed retry state                                         |
| `components/refresh-session.tsx`     | refresh page UI                                                 |
| `hooks/use-session-refresh.ts`       | refresh mutation, outcome handling, cooldown schedule           |
| `hooks/use-countdown.ts`             | retry countdown                                                 |
| `hooks/use-mount-effect.ts`          | the only sanctioned `useEffect` wrapper                         |
| `services/authorization.service.ts`  | `authorizeRoute`: server-only, `cache()`, proxy headers         |
| `services/route-access.service.ts`   | `requireRouteAccess`: decisions to Next interrupts              |
| `services/route-policy.ts`           | pure route policy, shared with the proxy                        |
| `services/campus-proxy.service.ts`   | `guardCampusRequest`: cookie-presence redirects, render headers |
| `services/campus-request-headers.ts` | proxy-to-render header names                                    |
| `services/session.service.ts`        | `/v1/auth/me` read with retries; single-flight refresh POST     |
| `schemas/session.schema.ts`          | validates the session fields route policies depend on           |
| `schemas/return-to.ts`               | Campus return-destination policy                                |
| `types/auth.types.ts`                | public types                                                    |

Client modules import siblings directly, never `index.ts`: the entry point
re-exports server-only modules.

## Tests

```bash
pnpm vitest run --project unit features/auth ./proxy.test.ts
pnpm eval:route-protection
pnpm eval:session-read
```

Tests exercise the public interface in `index.ts`, and the root `proxy.ts`
through `proxy.test.ts` (matcher via `unstable_doesMiddlewareMatch`). The
backend is MSW (`tests/fixtures/mock-api.ts`), started inside `vi.hoisted`
because API clients capture `fetch` when created; request cookies and headers
are a mocked `next/headers`; time is Vitest fake timers. `forbidden()` needs
`__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS`, which `experimental.authInterrupts` sets
at build time; tests stub it. Components render inside a fresh `QueryClient`
(`tests/fixtures/query-client.tsx`).

Browser behaviour runs in Playwright against a local fake API
(`tests/e2e/authorization.spec.ts`, `tests/e2e/support/fake-auth-api.mjs`):
the Next.js proxy calls the backend server-side, so `page.route` cannot stand
in for it.

```bash
pnpm build
pnpm playwright test tests/e2e/authorization.spec.ts
```

React `cache()` is a pass-through outside a server render, so the one
`/v1/auth/me` read per navigation is asserted by the Playwright suite (fake API
hit count), not by unit tests.
