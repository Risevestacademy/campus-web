# Auth

Owns "may this request render a Campus or invitation route?" and "should
sign-in render, or send this visitor on?" Routes ask one function and branch
on the answer; session transport, retries, refresh, pre-join, and
return-destination policy stay behind it. Invite reads and acceptance belong
to `invitation`.

## Interface

| Entry      | Imported by         | Exports                                                                                                                                                        |
| ---------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts` | route code          | `requireRouteAccess`, `CohortGate`, `InvitationGate`, `ResumeInvitation`, `redirectSignedInVisitor`, `SessionUnavailable`, `AccountMenu`, `CampusEntryLink`, … |
| `proxy.ts` | the root `proxy.ts` | `guardCampusRequest` (no React, no `server-only`)                                                                                                              |

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

| Session                             | `campus-index`                           | `cohort`                                    | `system-admin`         |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------- | ---------------------- |
| `full_access`, system admin         | `allow` (admin catalogue)                | `allow`, any cohort                         | `allow`                |
| `full_access`, 2+ memberships       | `allow` (membership chooser)             | `allow` for their cohorts, else `forbidden` | `forbidden`            |
| `full_access`, exactly 1 membership | redirect active if entered, else `/join` | `allow` for their cohort, else `forbidden`  | `forbidden`            |
| `full_access`, no memberships       | `forbidden`                              | `forbidden`                                 | `forbidden`            |
| `provisional`                       | redirect `/invitation`                   | redirect `/invitation`                      | redirect `/invitation` |
| none, refresh not yet attempted     | redirect `/session/refresh?returnTo=…`   | same                                        | same                   |
| none, refresh already attempted     | redirect `/sign-in?returnTo=…`           | same                                        | same                   |

## Modules

| Module                              | Owns                                                       | Seam                                           |
| ----------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| `services/route-policy.ts`          | the policy above, as pure functions                        | none: shared by the proxy and `authorizeRoute` |
| `services/authorization.service.ts` | one `cache()`d session read per request, request signals   | `getServerApi()`                               |
| `services/session.service.ts`       | `/v1/auth/me` with retries, refresh POST, logout POST      | `ApiClient`                                    |
| `services/campus-proxy.service.ts`  | pre-join redirects and render headers, from cookies only   | `NextRequest`                                  |
| `services/campus-entry-session*.ts` | the per-cohort entry marker cookie                         | `document.cookie` / request cookies            |
| `schemas/`                          | session parsing; return-destination rules (`return-to.ts`) | none                                           |
| `components/`                       | gates, `SessionUnavailable`, refresh page, account menu    | none                                           |
| `hooks/`                            | refresh and logout mutations, countdown, `useMountEffect`  | `browserApi`                                   |

Flow: page → gate or `requireRouteAccess` → `authorizeRoute` →
`route-policy` + `session.service`.

## Contributing

### Protecting a new page

- Active Campus page (`app/campus/[id]/(active-campus)/`): wrap the content
  in `CohortGate`.
- Cohort Administration page (`app/campus/[id]/(administration)/`): call
  `requireRouteAccess({ kind: "system-admin" })`.
- Any other `/campus` page: call `requireRouteAccess` with its kind.
- Add the page to `tests/evals/campus-page-authorization.eval.test.tsx`; it
  fails while any page under `app/campus` is missing.
- A Cohort Administration page also adds its segment to
  `NON_ACTIVE_CAMPUS_SEGMENTS` in `schemas/return-to.ts`, or the proxy sends
  administrators to `/join`. The route-protection eval walks every page in
  `(administration)/` and catches it.

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
- The proxy checks cookies only and never calls the backend.
- Sign-in never refreshes and never redirects without a usable session; it is
  the exit from every failed state, which is what prevents redirect loops.
- Every redirect target goes through `normalizeReturnTo` /
  `normalizeCohortReturnTo`.
- Links into a cohort target `/campus/{id}`; the proxy alone decides whether
  pre-join comes first.
- Client modules import auth siblings directly, never `index.ts` (it
  re-exports server-only modules).
- Other features never import auth; routes pass `AccountMenu` and gates in.
- Navigation that must drop the media session uses `replaceDocument`.
- `useMountEffect` is the only sanctioned `useEffect` wrapper.
- Comment only a non-obvious why.

### Known gaps

- OAuth deep links: `core/api/client/proxy.ts` only rewrites a callback to
  `/`, so a stored `returnTo` can be lost after Google sign-in.
- A member with no cohort lands on the 403 page with no way to log out.
- The rail avatar initial is a placeholder "J".

## Tests

```bash
pnpm vitest run --project unit features/auth ./proxy.test.ts
pnpm eval:route-protection
pnpm eval:architecture
pnpm build && pnpm playwright test tests/e2e/authorization.spec.ts tests/e2e/pre-join-media.spec.ts
```

`eval:route-protection` walks every entry route and session state for loops
and leaks. `eval:architecture` keeps the root proxy on `proxy.ts`. Playwright
asserts what unit tests cannot: one `/v1/auth/me` per navigation, retries
reaching the network, and the entry marker across reloads, tabs, and logout.
