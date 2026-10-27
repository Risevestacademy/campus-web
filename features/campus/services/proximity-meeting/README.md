# Proximity meeting

Who the meeting view shows, from presence. World decides who is near
(`nearby`, in a proximity space); this module only turns presence into the
view's people and layout. It never measures distance.

## Interface

```ts
import { useProximityMeeting } from "../../hooks/use-proximity-meeting";

const meeting = useProximityMeeting(cohortId); // ProximityMeeting | null
```

- `selectProximityMeeting(presence)`: you first, then whoever `nearby`
  names that presence knows, in the order they came near. `null` before
  `welcome` or while nobody known is near.
- `meetingParticipantOf(participant)`: name (`"Campus member"` when world
  has none), initials, and a tone hashed from the user id, so a person keeps
  one colour however the list changes.
- `visibleMeetingLayout(layout, meeting)`: the grid only for the encounter
  it was opened in, and no focus on somebody who walked away.
- `splitAtCap(items, cap)`: the shown items and how many more.

All pure; `useProximityMeeting` is the only React seam. It selects stable
presence references with `useShallow` and derives with `useMemo`: a selector
that built a fresh object would loop `useSyncExternalStore`.

## Tests

```bash
pnpm vitest run --project=unit features/campus/services/proximity-meeting
pnpm eval:proximity
```
