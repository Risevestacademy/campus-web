# Auth

Owns the questions "may this request render a Campus or invitation route?"
and "should sign-in render, or send this visitor on?" Route code asks one
function and branches on the answer. Session transport, retries, and
return-destination policy stay behind it.

## Public interface

Route code imports from `@/features/auth`. The root `proxy.ts` imports from
`@/features/auth/proxy` instead (see [Root proxy](#root-proxy)).

```tsx
import {
  CampusShellGate,
  CohortGate,
  InvitationGate,
  redirectSignedInVisitor,
  requireRouteAccess,
  SessionUnavailable,
} from "@/features/auth";

// Layouts and pages that only need "may this render?"
<CampusShellGate>{children}</CampusShellGate>;

// Everything under /campus/[id]: also requires membership of that cohort
<CohortGate cohortId={id}>{children}</CohortGate>;

// /invitation and /preview: requires a session carrying an invite
<InvitationGate path="/invitation">{children}</InvitationGate>;

// /sign-in: sends a signed-in visitor on before anything renders
await redirectSignedInVisitor(returnTo);

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

Requests are `{ kind: "campus-shell" }`, `{ kind: "campus-index" }`,
`{ kind: "cohort", cohortId }`, or `{ kind: "invitation", path }`. On Campus
the return destination comes from the root proxy, not the caller (layouts
cannot see the URL); invitation requests name their own page, since no proxy
runs there. Everything here is server-only and reads request headers, so any
route that uses it renders per request.

Every `/campus/**` page checks access itself as well as the `(app)` layout:
layouts keep their state across soft navigation and would not run again.
`cache()` keeps that to one `GET /v1/auth/me` per request.

Under `/campus/[id]`, the `[id]` layout and every page use `CohortGate`. The
layout refuses a non-member before the media session provider mounts, and
re-runs when a soft navigation changes cohort; the pages re-check the session
on every soft navigation inside one cohort. A new page under `/campus/[id]`
must wrap its content in `CohortGate` too.

`/invitation` and `/preview` each wrap their content in `InvitationGate`.
There is no guarding layout: `/invitation` links to `/preview`, a soft
navigation a layout would not re-run on. During an outage the gate renders
`SessionUnavailableNotice`, because the auth layout already owns `<main>`.

`resolveSignIn(returnTo)` returns `render` or `redirect` for `/sign-in`, and
`redirectSignedInVisitor(returnTo)` turns the redirect into Next's
`redirect()`. Sign-in is not a `RouteAuthorizationRequest`: it is the one
route where "no session" means render, and keeping it out keeps
`requireRouteAccess` free of an allow-without-session case.

## Log out

`AccountMenu` (client) wraps the caller's avatar in a menu with one item, Log
out. `useLogOut` posts `/api/v1/auth/logout` through `browserApi`: only the
browser can, since `campus_refresh` is scoped to `/api/v1/auth`.

| Backend answer          | Result                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------- |
| 2xx, or 401             | capture `auth.logout` (`user_action`), `resetAnalyticsUser()`, full load of `/sign-in` |
| other status, or thrown | error toast "We couldn't log you out"; nothing else changes and the visitor may retry  |

The full load (`replaceDocument`, `shared/lib/document-navigation.ts`) drops
the media session and query cache and replaces the history entry. Navigating
after a failure would be wrong: the cookies survive, so sign-in would send the
visitor straight back to Campus.

Placement follows the cohort chooser: `logsOutFromRail(session)` is false for
admins and members of several cohorts, who log out from the `/campus` header,
and true for everyone else, who never see `/campus` and log out from the
campus rail. The rail sits in another feature, so
`app/(app)/campus/[id]/(active-campus)/layout.tsx` composes the menu into
`CampusRail`'s `account` slot.

## Session outcomes

`GET /v1/auth/me` is called directly through `getServerApi()`, never through
the browser `/api` proxy. A request without a `campus_session` cookie is
`unauthenticated` without a backend call.

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

| Session                             | `campus-shell`                         | `campus-index` (`/campus`)         | `cohort` (`/campus/[id]/**`)                |
| ----------------------------------- | -------------------------------------- | ---------------------------------- | ------------------------------------------- |
| `full_access`, system admin         | `allow`                                | `allow` (admin chooser)            | `allow`, any cohort ID                      |
| `full_access`, 2+ memberships       | `allow`                                | `allow` (membership chooser)       | `allow` for their cohorts, else `forbidden` |
| `full_access`, exactly 1 membership | `allow`                                | redirect `/campus/{cohortId}/join` | `allow` for their cohort, else `forbidden`  |
| `full_access`, no memberships       | `allow`                                | `forbidden`                        | `forbidden`                                 |
| `provisional`                       | redirect `/invitation`                 | redirect `/invitation`             | redirect `/invitation`                      |
| none, refresh not yet attempted     | redirect `/session/refresh?returnTo=…` | same                               | same                                        |
| none, refresh already attempted     | redirect `/sign-in?returnTo=…`         | same                               | same                                        |

The refresh-attempt marker breaks the refresh/redirect loop: one automatic
refresh per visit, then sign-in. A pending `inviteId` does not block a
`full_access` member.

Invitation routes (`invitation`, for `/invitation` and `/preview`):

| Session                                         | Decision                                    |
| ----------------------------------------------- | ------------------------------------------- |
| `provisional` or `full_access`, with `inviteId` | `allow`                                     |
| `full_access`, no `inviteId`                    | redirect `/campus`                          |
| `provisional`, no `inviteId`                    | redirect `/sign-in?error=invite_required`   |
| none, refresh not yet attempted                 | redirect `/session/refresh?returnTo=<page>` |
| none, refresh already attempted                 | redirect `/sign-in?returnTo=<page>`         |
| refused (403)                                   | `forbidden`                                 |
| outage                                          | `unavailable`, retry `<page>`               |

Sign-in (`decideSignIn`):

| Session                                   | Decision                                    |
| ----------------------------------------- | ------------------------------------------- |
| `full_access`                             | redirect to the normalized `returnTo`       |
| `provisional`, with `inviteId`            | redirect `/invitation` (`returnTo` ignored) |
| `provisional`, no `inviteId`              | render (the invitation sent it here)        |
| none, expired, refused, or session outage | render; no refresh, no retry state          |

Sign-in is the way out of every failed state, so it never refreshes and never
redirects without a usable session. That is what keeps sign-in, refresh,
invitation, and Campus from forming a loop; `pnpm eval:route-protection`
walks every entry route and session state to prove it.

## Root proxy

`guardCampusRequest` (exported from `@/features/auth/proxy`) runs for
`/campus/**` from the root `proxy.ts`. It checks cookie presence only and never
calls the backend:

- a hard load (`GET` with `Sec-Fetch-Dest: document`) of an active campus,
  meaning `/campus/{id}` or anything under it except `/campus/{id}/join`:
  redirect to `/campus/{id}/join?returnTo=…`. This runs before the session
  check, so a refresh or sign-in round trip comes back through pre-join, and
  it leaves the refresh marker for that `/join` request;

- no `campus_session`: redirect through refresh, or to sign-in once
  `campus_refresh_attempted` is present;
- `campus_session` present: pass through, writing two request headers the
  render reads (`services/campus-request-headers.ts`). Client-supplied values
  are overwritten or removed:

  | Header                       | Value                                            |
  | ---------------------------- | ------------------------------------------------ |
  | `x-campus-return-to`         | sanitized `pathname + search`                    |
  | `x-campus-refresh-attempted` | `1` when the marker cookie came with the request |

- the marker cookie (`Path=/`) is deleted on the first `/campus/**` response.

The render reads the marker from the header, not the cookie: Next copies
cookies the proxy sets or deletes into `cookies()` for the same request, so
after the deletion the cookie no longer says whether a refresh happened.

Invitation routes have no proxy, so they read the marker cookie itself.
Nothing deletes it there; it expires after its 60 s `Max-Age`.

`@/features/auth/proxy` exists because `index.ts` also exports client and
server-only modules, which do not belong in Next's proxy bundle. ESLint
enforces it: the root `proxy.ts` carries the `root-proxy` file category
(`config/architecture-boundaries.json`) and may import only a feature's
`proxy.ts` (`pnpm eval:architecture`).

## Pre-join

Every hard load of an active campus passes through `/campus/{id}/join`; soft
navigation never does. Join is a `<Link>` to the preserved destination, so
entry is a soft navigation and the media session in the `[id]` layout keeps
the camera and microphone chosen on the pre-join screen. Nothing is stored:
the browser's own `Sec-Fetch-Dest` header tells a hard load (`document`) from
a router fetch, prefetch, or Server Action call (`empty`).

A marker cookie would not work here. Next renders a Server Action's redirect
target through an internal request and drops every `Set-Cookie` from it, so a
one-request marker would live for its whole `Max-Age`; and `router.refresh()`
re-runs layouts, so a layout-level check would bounce visitors mid-visit.

Limits, by design (the gate is UX, membership is enforced on every request):

- browsers without Fetch Metadata (before Safari 16.4, Firefox 90) skip
  pre-join on hard loads;
- without JavaScript the active campus cannot be entered;
- after a deploy, a Join click can fall back to a full page load and land on
  pre-join once more.

Links into a cohort from outside it must target `/campus/{id}/join`, never an
active route: a soft navigation from `/campus` or another cohort would
otherwise skip pre-join. `CohortCard` and the `/campus` redirect follow this,
and their tests pin it.

## Return destinations

`normalizeReturnTo(value)` returns a same-origin path under `/campus`,
`/invitation`, or `/preview` with its query, or `/campus` when the value is
unsafe. It:

- keeps path and query, drops the fragment;
- percent-encodes the result so it is safe in a `Location` header;
- rejects absolute, protocol-relative, and other destinations (`/sign-in`
  included, so sign-in can never return to itself);
- rejects literal or percent-encoded `.`/`..` segments, encoded slashes,
  empty interior segments, backslashes, and control characters (raw or
  encoded);
- rejects malformed percent-encoding and values over 2048 characters.

`normalizeCohortReturnTo(cohortId, value)` applies the same rules and also
requires an active route of that cohort (not its `/join`); anything else
becomes `/campus/{cohortId}`. The pre-join page uses it for its Join link.

`parseReturnTo(value)` applies the same rules but returns `undefined`
instead of falling back, for callers that must distinguish "no valid
destination" (the OAuth proxy receives it by injection, since `core` cannot
import `features`). Client components never import this module: a Server
Component sanitizes the value and passes it down as a prop.

Dot segments are checked on the raw input. The URL parser resolves them
silently, so `/campus/42/../43` would otherwise look like a clean Campus path.

## Session refresh

`RefreshSession` (client component) renders `/session/refresh`. The route's
Server Component sanitizes `returnTo` with `normalizeReturnTo` and passes
it as a prop. The component follows the project flow:

```text
RefreshSession -> useSessionRefresh -> useMutation -> createSessionRefresher -> browserApi
```

- One automatic POST to `/api/v1/auth/refresh` on mount, never retried by
  TanStack Query (`retry: false`).
- Success replaces history with the destination; 401 replaces it with
  `/sign-in?returnTo=...`; anything else shows a fail-closed retry state.
  The sign-in URL carries no error: refresh answers 401 alike for a visitor
  who never signed in, so it cannot claim a session expired.
- Manual retry cooldowns: 1, 2, 4, then 8 seconds. A longer `Retry-After`
  extends a cooldown up to 8 seconds.
- `createSessionRefresher` shares one in-flight POST between concurrent
  callers. The refresh token rotates, so a second POST (for example from React
  StrictMode's double mount in development) would sign the visitor out. Each
  mounted page owns its refresher, so no request state outlives the page.

## Layout

| Path                                 | Role                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `index.ts`                           | public interface for routes                                                    |
| `proxy.ts`                           | public interface for the root `proxy.ts`                                       |
| `components/campus-shell-gate.tsx`   | renders children only when the visitor may enter Campus                        |
| `components/cohort-gate.tsx`         | renders children only for a member of the cohort (or an admin)                 |
| `components/invitation-gate.tsx`     | renders children only for a session carrying an invite                         |
| `components/access-gate.tsx`         | shared gate rendering: allow, retry state, or Next interrupt                   |
| `components/session-unavailable.tsx` | fail-closed retry state, with or without its own `<main>`                      |
| `components/refresh-session.tsx`     | refresh page UI                                                                |
| `components/account-menu.tsx`        | avatar menu with Log out                                                       |
| `hooks/use-log-out.ts`               | logout mutation, analytics, full load to sign-in or failure toast              |
| `hooks/use-session-refresh.ts`       | refresh mutation, outcome handling, cooldown schedule                          |
| `hooks/use-countdown.ts`             | retry countdown                                                                |
| `hooks/use-mount-effect.ts`          | the only sanctioned `useEffect` wrapper                                        |
| `services/authorization.service.ts`  | `authorizeRoute`, `resolveSignIn`: server-only, `cache()`, request signals     |
| `services/route-access.service.ts`   | `requireRouteAccess`, `redirectSignedInVisitor`: decisions to Next interrupts  |
| `services/route-policy.ts`           | pure route policy, shared with the proxy                                       |
| `services/campus-proxy.service.ts`   | `guardCampusRequest`: pre-join gate, cookie-presence redirects, render headers |
| `services/campus-request-headers.ts` | proxy-to-render header names                                                   |
| `services/session.service.ts`        | `/v1/auth/me` read with retries; single-flight refresh POST; logout POST       |
| `schemas/session.schema.ts`          | validates the session fields route policies depend on                          |
| `schemas/return-to.ts`               | return-destination policy, active-campus path rules                            |
| `types/auth.types.ts`                | public types                                                                   |

Client modules import siblings directly, never `index.ts`: the entry point
re-exports server-only modules.

## Tests

```bash
pnpm vitest run --project unit features/auth ./proxy.test.ts
pnpm eval:route-protection
pnpm eval:logout
pnpm eval:session-read
pnpm eval:architecture
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
pnpm playwright test tests/e2e/authorization.spec.ts tests/e2e/pre-join-media.spec.ts
```

E2E tests enter an active campus the way a visitor does, through
`enterCampus` (`tests/e2e/support/campus-entry.ts`): a direct `page.goto` of
an active route stops at pre-join.

React `cache()` is a pass-through outside a server render, so the one
`/v1/auth/me` read per navigation is asserted by the Playwright suite (fake API
hit count), not by unit tests.
