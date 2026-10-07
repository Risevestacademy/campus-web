# Campus

Owns the member-facing Cohort chooser and the Active Campus: the rail and
sidebar around a Cohort's campus and the in-room media UI.

## Cohort chooser

```tsx
import { CohortChooser } from "@/features/campus";

<CohortChooser viewer={session} />;
```

| Memberships | Sees                                              |
| ----------- | ------------------------------------------------- |
| one or more | each Cohort from the Campus Access Session        |
| none        | explanation directing the member to an Invitation |

The chooser never requests the System Administrator Cohort catalogue. The
`/campus` route composes the separate Admin catalogue for administrators.

## Active Campus

`app/campus/[id]/(active-campus)/layout.tsx` composes one module:

```tsx
import { ActiveCampus } from "@/features/campus";

<ActiveCampus
  AccountMenu={logsOutHere ? AccountMenu : undefined}
  OverviewPanel={CampusOverviewPanel}
>
  {children}
</ActiveCampus>;
```

| Prop            | Meaning                                                              |
| --------------- | -------------------------------------------------------------------- |
| `AccountMenu`   | optional; wraps the rail avatar (auth's Log out menu)                |
| `OverviewPanel` | fills the map panel; receives `collapseButton`. Others "Coming soon" |
| `children`      | the route's map or meeting content                                   |

`ActiveCampus` is a Server Component: both props are components, which cannot
cross into a client component. The route supplies them because this feature
may not import `auth` or `roster`.

The sidebar state (open, active panel) lives in `store/sidebar-store.ts`,
persisted under `campus-sidebar` in `localStorage` and mirrored on
`<html data-sidebar-open>` so the root layout's `sidebarInitializerScript`
(imported from `@/features/campus/document`, never the barrel) can size the
sidebar before hydration. Components read it through
`hooks/use-sidebar-state.ts`.

| Interaction                      | Effect                                   |
| -------------------------------- | ---------------------------------------- |
| Rail panel button                | that panel becomes active; sidebar opens |
| Collapse sidebar                 | sidebar closes                           |
| Header "Open sidebar"            | sidebar toggles                          |
| Grid view (switch or tile)       | sidebar closes                           |
| Sidebar reopens during grid view | meeting returns to map view              |

## Tests

```bash
pnpm vitest run --project=unit features/campus
pnpm vitest run --project=unit \
  tests/evals/meeting-header.eval.test.tsx \
  tests/evals/meeting-view-switch.eval.test.tsx \
  tests/evals/campus-control-bar.eval.test.tsx
```

The Active Campus evals render the real route layout
(`tests/fixtures/active-campus-layout.tsx`) with auth stubbed.
