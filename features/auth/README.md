# Auth

Owns "may this request render a Campus or invitation route?" and "should
sign-in render, or send this visitor on?" Routes ask one function and branch
on the answer; session transport, retries, refresh, and return-destination
policy stay behind it. Pre-join is an explicit Campus navigation route. Invite
reads and acceptance belong to `invitation`.

## Interface

| Entry      | Imported by         | Exports                                                                                                                                                                                         |
| ---------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts` | route code          | `requireRouteAccess`, `CohortGate`, `CohortSession`, `ForgetPreviousMember`, `SessionRefreshProvider`, `InvitationGate`, `ResumeInvitation`, `redirectSignedInVisitor`, `SessionUnavailable`, … |
| `proxy.ts` | the root `proxy.ts` | `guardCampusRequest` (no React, no `server-only`)                                                                                                                                               |

```tsx
const access = await requireRouteAccess({ kind: "system-admin" });
if (access.kind === "unavailable") {
  return <SessionUnavailable retryHref={access.retryHref} />;
}
access.session;
```

`requireRouteAccess` turns `redirect` into `redirect()` and `forbidden` into
`forbidden()`, so a route only handles `allow` or `unavailable`. Requests are
`campus-index`, `cohort`, `system-admin`, or `invitation`. The policy:

| Session                             | `campus-index`                         | `cohort`                                    | `system-admin`         |
| ----------------------------------- | -------------------------------------- | ------------------------------------------- | ---------------------- |
| `full_access`, system admin         | `allow` (admin catalogue)              | `allow`, any cohort                         | `allow`                |
| `full_access`, 2+ memberships       | `allow` (membership chooser)           | `allow` for their cohorts, else `forbidden` | `forbidden`            |
| `full_access`, exactly 1 membership | redirect `/join`                       | `allow` for their cohort, else `forbidden`  | `forbidden`            |
| `full_access`, no memberships       | `forbidden`                            | `forbidden`                                 | `forbidden`            |
| `provisional`                       | redirect `/invitation`                 | redirect `/invitation`                      | redirect `/invitation` |
| none, refresh not yet attempted     | redirect `/session/refresh?returnTo=…` | same                                        | same                   |
| none, refresh already attempted     | redirect `/sign-in?returnTo=…`         | same                                        | same                   |

## Modules

| Module                                    | Owns                                                          | Seam                                           |
| ----------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `services/route-policy.ts`                | the policy above, as pure functions                           | none: shared by the proxy and `authorizeRoute` |
| `services/authorization.service.ts`       | one `cache()`d session read per request, request signals      | `getServerApi()`                               |
| `services/session.service.ts`             | `/v1/auth/me` with retries, refresh POST, logout POST         | `ApiClient`                                    |
| `services/campus-proxy.service.ts`        | session refresh redirects and trusted render headers          | `NextRequest`                                  |
| `services/session-renewal.ts`             | Session Renewal: when to renew, retries, cross-tab skips      | ports: refresh, lock, shared expiry, wake      |
| `services/browser-session.ts`             | browser adapters for those ports; the refresh singletons      | `browserApi`, Web Locks, `localStorage`        |
| `services/refresh-cooldown.ts`            | the 1/2/4/8 s backoff, stretched by `Retry-After`             | none                                           |
| `services/member-analytics.ts`            | a cohort visit's analytics: user, system role, cohort, role   | none: pure                                     |
| `schemas/`                                | session parsing; return-destination rules; sign-in error copy | none                                           |
| `components/`                             | gates, `CohortSession`, refresh page, account menu            | none                                           |
| `components/session-refresh-provider.tsx` | fills the shared refresh port with the locked refresher       | `core/session`                                 |
| `components/cohort-analytics.tsx`         | identifies the member and enters the cohort in PostHog        | `core/analytics/client`                        |
| `components/forget-previous-member.tsx`   | forgets an identified member on sign-in and invitation pages  | `core/analytics/client`                        |
| `hooks/`                                  | refresh, renewal and logout; countdown                        | `browserApi`, shared `useMountEffect`          |

Flow: page → gate or `requireRouteAccess` → `authorizeRoute` →
`route-policy` + `session.service`.

Session Renewal: the cohort layout's `CohortSession` (server) seeds
`SessionRenewalTimer` (client) with the cached session's `expiresAt`; its hook
starts `createSessionRenewal`, which POSTs the refresh at
`expiresAt − min(2 min, remaining / 4)` under the `campus-session-renewal` Web
Lock, skips when another tab already renewed (`localStorage`, ignored when more
than one 15-minute access-token lifetime ahead), and re-checks on
`visibilitychange`, `focus`, `online` and `pageshow`. It never navigates, so
the Presence Session keeps running. `/session/refresh` remains the cold-load
path: a reload, a new tab, or a wake after the access cookie already lapsed.

Analytics identity: `CohortSession` reads route access once and also maps the
cached session through `memberAnalyticsFor`. PostHog gets the Campus user ID
with `system_role` on the person, and `cohort_id` + `cohort_role` (`null` for
an admin without a place) plus the `cohort` group on the tab's events only. `CohortAnalytics` (client)
identifies and enters the cohort on mount and leaves it on unmount; its key is
those values, so a role picked up by `router.refresh()` re-sends them. No name
or email leaves the session. A cohort role this build does not know parses as
absent, so the member keeps access. PostHog receives the identity only once the
member accepts analytics; an earlier identity waits and is sent on Accept.

Every reset takes a new device ID. An `expired` renewal calls
`resetAnalyticsUser()` before its toast. `ForgetPreviousMember` forgets an
identified member on the sign-in page and, for a signed-out visitor
(`isSignedOut()`), on the invitation page, whose Google button skips
sign-in. That covers a cold expiry. A member still signed in keeps their
identity on a new invite, and an anonymous visit stays, so an invitation
joins its login. Identify also forgets a different member still identified on
the device. The root layout's `BrowserPageview` captures each pageview after
these effects, so the first pageview is never sent as the previous member.
Every reset keeps the device's analytics choice. `AccountMenu` offers
"Privacy choices" above Log out, which reopens the consent banner
(`core/analytics/consent`).

A reset clears PostHog's shared storage, so another open tab drops the
identity too. That is intended: a reset only follows a session that ended for
every tab, and a tab that renews re-identifies on its next cohort mount.

`SessionRefreshProvider` lends the same locked refresher to features that may
not import auth, through `useRefreshSession()` in `core/session` — the
cross-feature refresh contract lives there, so realtime and auth read one
type (`SessionRefreshResult`: `refreshed`/`expired`/`failed` with
`retryAfterMs`). The cohort layout wraps the Presence Session in the
provider, so world's `session_ended` and `session_expired` closes renew in
place; with no provider the port answers `expired`.

### What the proxy is for

Next.js 16 treats Proxy as an optimistic, cookie-only layer: it runs before
every matched request, including prefetches, is "not intended for slow data
fetching", and "should not be used as a full session management or
authorization solution" (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`,
`02-guides/authentication.md`, "Optimistic checks with Proxy").

| Proxy does                                                     | Proxy never does                                        |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| Check that the session cookie exists                           | Authorize a route, role, or cohort                      |
| Redirect a request with no session cookie to refresh / sign-in | Read the session from the backend (`/v1/auth/me`)       |
| Set trusted request headers (`returnTo`, refresh attempted)    | Fetch data; `fetch` caching has no effect in Proxy      |
| Clear its own one-shot marker cookie                           | Rely on module globals; it may run apart from rendering |

Authorization stays close to the data: each page calls `requireRouteAccess`
(one `cache()`d session read per request), because layouts do not re-render on
client navigation. The backend remains the final authority.

## Contributing

### Protecting a new page

- Active Campus page (`app/campus/[id]/(active-campus)/`): wrap the content
  in `CohortGate`.
- Cohort Administration page (`app/campus/[id]/(administration)/`): call
  `requireRouteAccess({ kind: "system-admin" })`.
- Any other `/campus` page: call `requireRouteAccess` with its kind.
- Add the page to `tests/evals/campus-page-authorization.eval.test.tsx`; it
  fails while any page under `app/campus` is missing.
- Every cohort page except `/join` is a valid pre-join return destination
  (`normalizeCohortReturnTo`), so a reload returns there after Join. The
  route-protection eval walks every page in `(administration)/`.

Every page checks for itself, even under a checking layout: Next renders a
layout and its page in parallel, and keeps layouts across soft navigation.
`cache()` keeps it to one backend read per request.

### Adding a request kind

1. Add it to `CampusRouteRequest` in `types/auth.types.ts`.
2. Decide it in `route-policy.ts` (exhaustive `switch`) and add its column
   above.
3. Cover every session row in `route-policy` tests and
   `tests/evals/campus-route-protection.eval.test.ts`.

### Rules

- An outage is never "signed out"; malformed sessions count as outages.
- `Session` holds only the fields routes and screens read. `session.schema.ts`
  strips the rest of `/v1/auth/me`; widen it there, and in
  `tests/evals/data-privacy.eval.test.ts`, never by casting the raw body.
- A `?error=` code is looked up through its Zod enum, so an unknown code
  (including a prototype key) gets the generic message and is never echoed.
- Invite return destinations (`/invitation`, `/preview`) keep no query string.
- The proxy checks cookies only and never calls the backend, not even to
  refresh (see "What the proxy is for"); `eval:session-renewal` enforces it.
  Session Renewal keeps the access cookie alive in the browser instead.
- Sign-in never refreshes and never redirects without a usable session; it is
  the exit from every failed state, which is what prevents redirect loops.
- Every redirect target goes through `normalizeReturnTo` /
  `normalizeCohortReturnTo`.
- Cohort-selection links target `/campus/{id}/join`; Join grants its validated
  destination in the cohort's Presence Session before client navigation.
- Session refresh shares one in-flight rotating-token request across soft-route
  remounts. On success it replaces the native history URL and refreshes that
  route's server tree, avoiding a stale middleware-redirect target.
- Every refresh POST runs under the `campus-session-renewal` Web Lock. The
  refresh page locks inside its single-flight, since a lock around it would let
  StrictMode's second caller spend the rotated token. Session Renewal locks
  around its other-tab check and its own unlocked refresher, since Web Locks
  are not reentrant.
- Session Renewal never ends a Presence Session. An `expired` renewal shows a
  persistent "Your session ended" toast; signing in is the member's choice.
- Pre-join is preparation, not authorization. Direct cohort URLs are checked
  by `CohortGate` / `requireRouteAccess` first, then requests without an exact
  pending destination return through pre-join. The client grant never grants
  cohort access.
- Client modules import auth siblings directly, never `index.ts` (it
  re-exports server-only modules).
- Other features never import auth; routes pass `AccountMenu` and gates in.
- Navigation that must drop the media session uses `replaceDocument`.
- Shared `useMountEffect` is the only sanctioned `useEffect` wrapper.
- Comment only a non-obvious why.

### Known gaps

- OAuth deep links: `core/api/client/proxy.ts` only rewrites a callback to
  `/`, so a stored `returnTo` can be lost after Google sign-in.
- A member with no cohort lands on the 403 page with no way to log out.
- The rail avatar initial is a placeholder "J".
- A refresh POST that hangs holds the Web Lock, so other tabs wait to renew;
  each tab's wake signals still retry once it is released.
- A server clock more than 2 min behind the browser can reject a renewed token
  within 60 s; the relay's `campus_refresh_attempted` marker then sends that
  request to sign-in instead of refresh.
- An anonymous visit on a shared device (an invitation opened but never
  signed in) merges into the next member who signs in there. Sign-in keeps
  anonymous visits so an invitation joins its login.
- No proxy refresh runs on `/invitation`, so a member whose access cookie
  lapsed reads as signed out there and is forgotten. They re-identify on their
  next cohort page, as a new device.

## Tests

```bash
pnpm vitest run --project unit features/auth ./proxy.test.ts
pnpm eval:route-protection
pnpm eval:session-renewal
pnpm eval:analytics
pnpm eval:privacy
pnpm eval:architecture
pnpm build && pnpm playwright test tests/e2e/authorization.spec.ts tests/e2e/pre-join-media.spec.ts
```

`eval:route-protection` walks every entry route and session state for loops
and leaks. `eval:session-renewal` keeps renewal mounted outside the keyed
Presence Session, the proxy cookie-only, and cohort code off `/session/refresh`.
`eval:analytics` keeps `CohortSession` inside `CohortGate` and outside the
Presence Session, `ForgetPreviousMember` on sign-in and on the invitation for
a signed-out visitor, and `BrowserPageview` last in the root layout. It checks
that every session shape sends only the user ID, system role, cohort ID and
cohort role, and drives the real PostHog SDK: no invitation token in
`$identify`, cohort context on the tab only, a new person and device at
sign-in, an invitation's visit joined to its login, no automatic pageview, the
sign-in pageview sent as the next person, a cohort's landing pageview tagged
with it, no cohort carried into a full load, and the cohort kept across a
PostHog session rotation. `eval:architecture` keeps the root proxy on `proxy.ts`. Playwright
asserts what unit tests cannot: one `/v1/auth/me` per navigation, retries
reaching the network, explicit pre-join preparation, stateless Join
navigation, and a camera that stays live past the access token's lifetime.
