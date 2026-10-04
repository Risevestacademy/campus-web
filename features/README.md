# Features

Business behavior is organized by product domain.

Planned domains:

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

`campus` owns the cohort chooser and the Active Campus, including the rail and
sidebar chrome around it (navigation, panel switching, the collapse/reopen
state) — not a class or mentorship session, which is a distinct, later
concept. `roster` owns the participant directory UI (search, filters, the
online/offline lists); once real-time status lands, it will consume it from
`presence` rather than own it.

Create a feature directory only when implementation starts. Colocate its
components, hooks, services, schemas, state, types, and tests. Expose consumers
through `index.ts`; do not deep-import another feature or import feature-to-feature.

The one other entry point is `proxy.ts`, for code the root `proxy.ts` runs.
Next bundles the proxy separately, so that entry must not pull in React,
client components, or `server-only` modules. Only `auth` has one today.
