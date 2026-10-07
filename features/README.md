# Features

Business behavior is organized by product domain.

Planned domains:

- admin
- auth
- campus
- campus-world
- avatar
- roster
- presence
- proximity
- communication
- classroom
- desk
- notice-wall
- resource-centre
- stage
- profile

`admin` owns System Administrator catalogues and mutations under the `/campus`
route hierarchy. `campus` owns the member-facing Cohort chooser and the Active
Campus, including the rail and sidebar chrome around it (navigation, panel
switching, and collapse/reopen state) — not a class or mentorship session,
which is a distinct, later concept. `roster` owns the participant directory UI
(search, filters, and online/offline lists); once real-time status lands, it
will consume that status from `presence` rather than own it.

Create a feature directory only when implementation starts. Colocate its
components, hooks, services, schemas, state, types, and tests. Expose consumers
through `index.ts`; do not deep-import another feature or import feature-to-feature.

Two other entry points exist, each enforced by
`config/architecture-boundaries.json`:

- `proxy.ts`, for code the root `proxy.ts` runs. Next bundles the proxy
  separately, so that entry must not pull in React, client components, or
  `server-only` modules. Only `auth` has one today.
- `document.ts`, for code the root `app/layout.tsx` needs before hydration.
  Every client module reachable from an import in the root layout ships on
  every page, so the root layout may not import a feature's `index.ts`. Only
  `campus` has one today.

`package.json` marks every module except CSS as free of import-time side
effects, so the bundler drops barrel exports a page does not use. Keep it
true: a module must not need to be imported only for what it does at load.

Client providers live with the routes that use them, not in the root layout:
`app/providers.tsx` (query client and toasts) wraps `app/campus/layout.tsx`,
`/preview` and `/session/refresh`; `ActiveCampus` owns its `TooltipProvider`.
The root layout keeps only theme behaviour, so `/` and `/sign-in` ship none of
it.
