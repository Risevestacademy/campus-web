# Roster

Owns the participant directory in the Campus Shell's Overview (map) panel:
search, status filters, online and offline groups, and quick-transport
destinations. A participant is a Cohort member as the roster lists them, with
a presence status. Real-time status will come from `@/core/presence`.

## Interface

```tsx
import { CampusOverviewPanel } from "@/features/roster";

<CampusShell OverviewPanel={CampusOverviewPanel} … />;
```

`CampusOverviewPanel` receives only the sidebar's `collapseButton`. It is the
current mock-data adapter for the prop-driven `CampusOverview` view. The route
passes the panel in because Campus may not import Roster.

## Modules

| Module                                           | Owns                                          | Seam                                       |
| ------------------------------------------------ | --------------------------------------------- | ------------------------------------------ |
| `campus-overview.tsx`, `participant-row.tsx`     | prop-driven view, search, grouped lists, rows | participant and transport intent callbacks |
| `campus-overview-panel.tsx`                      | current mock-data binding                     | replaced by Presence binding               |
| `participant-filters.ts`, `types.ts`             | status filter ids and matching                | none                                       |
| `quick-transport.ts`, `quick-transport-list.tsx` | destination data and list                     | none                                       |
| `mock-participants.ts`                           | stand-in data                                 | replaced by `core/presence`                |

No Presence contract exists yet. Only the thin panel adapter reads mock data;
the view receives participants, counts, context, and callbacks as props.

## Contributing

### Adding a status filter

1. Add the status to `ParticipantStatus` in `types.ts`.
2. Add its entry to `participantFilters` in `participant-filters.ts`.

### Adding a destination

Add it to `quickTransportDestinations` in `quick-transport.ts`.

### Rules

- Import no other feature; presence data will arrive through the panel's
  props or a `presence` interface, never a deep import.
- Comment only a non-obvious why.

## Tests

```bash
pnpm vitest run --project=unit features/roster
```
