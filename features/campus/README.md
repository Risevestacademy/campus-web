# Campus

Owns `/campus` and the meeting room: the cohort chooser, admin cohort
creation, and the in-room media UI.

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

## Tests

```bash
pnpm vitest run --project unit features/campus
pnpm eval:cohort-create
```

`pnpm eval:cohort-create` renders the admin chooser, double-clicks submit for
every backend answer and for invalid input, and fails on any mismatched screen,
more than one POST per double-click, or any POST for invalid input. Form
helpers live in `tests/fixtures/cohorts.ts`.

## Known gaps

- No track UI: a new cohort has no tracks, and students need a `cohortTrackId`
  to be invited. Attach tracks through campus-api for now.
- No edit or delete of cohorts.
