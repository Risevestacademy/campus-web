# Roster

Owns the participant directory in the Campus Shell's Overview (map) panel:
search, status filters, online and offline groups, and quick-transport
destinations. A participant is a Cohort member as the roster lists them. Online
rows come from `@/core/presence`, offline rows from the cohort directory, and
the sidebar's label from the member's place in the session.

## Interface

```tsx
import { CampusOverviewPanel } from "@/features/roster";

<CampusShell OverviewPanel={CampusOverviewPanel} cohort={…} cohortId={id} … />;
```

`CampusOverviewPanel` receives the sidebar's `collapseButton`, the `cohortId`
and the member's `cohort` (`{ name, role? }`, from the session). The route
passes the panel in because Campus may not import Roster.

### What the rows show

- **Online** is connected to the world right now. The member's own row comes
  first with the detail `You`; the others keep the order the store has.
- **Status** is what world reports: Available (green dot), Busy (red) or Away
  (yellow). Someone available in any space but `_default` still counts as
  Available, and their detail line says In a room. Room names are not shown
  yet.
- **Offline** is the cohort directory minus everyone online. The group is
  hidden until a current snapshot has arrived (not after the socket closes,
  until the next one) and whenever the directory is loading, being fetched
  again or unreadable, so it never shows a count it could not check. Offline
  rows have a grey dot, no detail line and no actions.
- **Avatar colors** come from the person's ID, since the backend sends none:
  one of four tones, the same for everyone who looks, online or off. They
  leave out the success, error and warning colors the status dots use.
- **Names** are the display name, or `Campus member` when it is null or blank.
  A user ID is never shown as a name.
- The roster shows no role for anyone else, no Do Not Disturb state and no
  coordinates: the profiles list carries no role, world has no Do Not Disturb,
  and a tile means nothing to a member.
- Busy appears only for people whose client sends `setStatus`; the web client
  does not yet. Wave, Go to and Message do nothing yet.

## Modules

| Module                                           | Owns                                                | Seam                                       |
| ------------------------------------------------ | --------------------------------------------------- | ------------------------------------------ |
| `campus-overview.tsx`, `participant-row.tsx`     | prop-driven view, search, grouped lists, rows       | participant and transport intent callbacks |
| `campus-overview-panel.tsx`                      | binds the view to the presence store and directory  | `presenceFor(cohortId)`, directory hook    |
| `presence-participants.ts`                       | pure adapter from presence and directory to rows    | none                                       |
| `context-label.ts`                               | `{cohort name} · {role}` from the session           | none                                       |
| `schemas/`, `services/`, `hooks/`                | reading and parsing `GET /v1/cohorts/{id}/profiles` | `@/core/api/client`                        |
| `participant-filters.ts`, `types.ts`             | status filter ids and matching                      | none                                       |
| `quick-transport.ts`, `quick-transport-list.tsx` | destination data and list                           | none                                       |
| `testing/world-messages.ts`                      | world messages for tests                            | none                                       |

## Contributing

### The search shortcut

Ctrl F focuses the search. The listener is on the window in the capture phase,
so the browser's find never sees it, and it steps aside when the search is
behind a modal or faded out with the sidebar.

### Adding a status filter

1. Add the status to `ParticipantStatus` in `types.ts`.
2. Add its entry to `participantFilters` in `participant-filters.ts`.
3. Give it a badge color in `participant-row.tsx`.

### Adding a destination

Add it to `quickTransportDestinations` in `quick-transport.ts`.

### Rules

- Import only `@/core/presence`, `@/core/api` and `shared`; no other feature.
  `features/feedback` reads the same endpoint for its own picker, and each
  keeps its own copy.
- Parse the directory where it arrives and keep only `id` and `displayName`.
- Subscribe with `useStore`; select `participants`, `selfId` and the `synced`
  flag separately and build the rows inside `useMemo`.
- Comment only a non-obvious why.

## Tests

```bash
pnpm vitest run --project=unit features/roster
pnpm eval:presence
```
