# Campus

Owns `/campus` and the Active Campus: the cohort chooser, admin cohort
creation, the rail and sidebar around a cohort's campus, and the in-room media
UI.

## Cohort chooser

```tsx
import { CohortChooser } from "@/features/campus";

<CohortChooser viewer={session} page={page} api={await getServerApi()} />;
```

| Viewer | Reads                    | Sees                                                        |
| ------ | ------------------------ | ----------------------------------------------------------- |
| member | session memberships only | their cohorts, no create tile                               |
| member | no memberships           | "You're not in a cohort yet…" pointing to an invite         |
| admin  | `GET /v1/cohorts?page=N` | "Create cohort" tile first, then that page, then pagination |
| admin  | an empty list            | "No cohorts yet…" above the create tile                     |
| admin  | the list fails to load   | alert with Try again, no create tile                        |

## Creating a cohort (admins)

The tile is a client island inside the server-rendered grid. It opens a dialog
whose form sends `POST /v1/cohorts` from the browser through the `/api` proxy.

```text
CreateCohortTile → CreateCohortForm → parseNewCohort (zod)
                → useCreateCohort → createCohort → browserApi → /api/v1/cohorts
```

| Field      | Rule                                                     |
| ---------- | -------------------------------------------------------- |
| Name       | required, trimmed                                        |
| Code       | required, trimmed, uppercased (shown uppercase as typed) |
| Start, End | optional `YYYY-MM-DD`; left out when empty; end ≥ start  |
| Status     | Upcoming (default), Active or Completed                  |

| Backend answer    | Admin sees                                                     |
| ----------------- | -------------------------------------------------------------- |
| 201               | dialog closes, "Cohort created" toast, page 1 of the chooser   |
| 400               | form alert: campus-api rejected these details                  |
| 401               | full load to `/sign-in`                                        |
| 409               | Code error: another cohort already uses this code              |
| 403, 5xx, network | "We couldn't create the cohort" toast; dialog keeps its values |

- On page 1 a success calls `router.refresh()`; on any other page it pushes
  `/campus`. The list is newest first, so the new cohort is always first.
- The mutation has `retry: false`. A lost 201 followed by a retry would be a
  409 for a cohort that exists.
- One POST per submit, even on a double-click or held Enter: `useCreateCohort`
  gates on a ref, because `isPending` reaches React a tick late.
- While the POST is in flight, Escape, the backdrop and Cancel do nothing.
- The popup unmounts on close, so every open starts with a blank form.
- Hiding the tile from members is cosmetic; campus-api's 403 is the guard.

### Motion

CSS transitions only, so an interrupted open reverses smoothly.

| Element      | Motion                                                                         |
| ------------ | ------------------------------------------------------------------------------ |
| Tile         | dashed box `scale(0.96)` on press (label stays); hover brightens border + plus |
| Dialog popup | `scale(0.96)` + fade in 200ms `cubic-bezier(0.23,1,0.32,1)`, out in 150ms      |
| Backdrop     | fade in 200ms, out in 150ms                                                    |
| Reduced      | fades only                                                                     |

### Analytics

`cohort.created` with `cohort_status`, captured once per 201.

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

The sidebar state (open, active panel) lives in `store/shell-store.ts`,
persisted under `campus-shell-ui` in `localStorage` and mirrored on
`<html data-sidebar-open>` so the root layout's `shellInitializerScript`
(imported from `@/features/campus/document`, never the barrel) can
size the sidebar before hydration. Components read it through
`hooks/use-shell-state.ts`.

| Interaction                      | Effect                                   |
| -------------------------------- | ---------------------------------------- |
| Rail panel button                | that panel becomes active; sidebar opens |
| Collapse sidebar                 | sidebar closes                           |
| Header "Open sidebar"            | sidebar toggles                          |
| Grid view (switch or tile)       | sidebar closes                           |
| Sidebar reopens during grid view | meeting returns to map view              |

## Tests

```bash
pnpm vitest run --project unit features/campus
pnpm eval:cohort-create
pnpm vitest run --project unit \
  tests/evals/meeting-header.eval.test.tsx \
  tests/evals/meeting-view-switch.eval.test.tsx \
  tests/evals/campus-control-bar.eval.test.tsx
```

The three Active Campus evals render the real route layout
(`tests/fixtures/active-campus-layout.tsx`) with auth stubbed.

`pnpm eval:cohort-create` renders the admin chooser, double-clicks submit for
every backend answer and for invalid input, and fails on any mismatched screen,
more than one POST per double-click, or any POST for invalid input. Form
helpers live in `tests/fixtures/cohorts.ts`.

## Known gaps

- No track UI: a new cohort has no tracks, and students need a `cohortTrackId`
  to be invited. Attach tracks through campus-api for now.
- No edit or delete of cohorts.
