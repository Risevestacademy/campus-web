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
`/campus` route composes the separate Admin catalogue for `admin` and
`super_admin` sessions.

## Active Campus

`app/campus/[id]/(active-campus)/layout.tsx` composes the shared Campus shell
around the Active Campus media surface:

```tsx
import { ActiveCampus, CampusShell } from "@/features/campus";

<CampusShell
  AccountMenu={logsOutHere ? AccountMenu : undefined}
  AdministrationPanel={adminSidebar}
  OverviewPanel={CampusOverviewPanel}
  cohortId={id}
>
  <ActiveCampus>{children}</ActiveCampus>
</CampusShell>;
```

`CampusShell` owns the rail, sidebar, and persisted sidebar mode. Active
Campus owns only meeting/media controls and route content. Administration
routes reuse the shell without mounting the media surface.

System Administrators receive an Administration rail control. It switches the
sidebar to the Admin-owned navigation panel. Selecting a normal rail panel
returns to Campus mode. Ordinary members never receive the admin panel or its
rail control. The route supplies Auth-, Admin-, and Roster-owned UI because
the Campus feature may not import those features.

Administration routes always open in Administration mode. The Active Campus
route may restore the administrator's last selected sidebar mode.

The sidebar state (open, active panel, mode) lives in `store/sidebar-store.ts`,
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
