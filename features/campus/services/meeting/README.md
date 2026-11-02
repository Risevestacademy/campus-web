# Meeting

Who the meeting view shows, from presence. Presence keeps who you meet
(`meetingRoster`: your room mates under room hearing, whoever is near
otherwise); this module only turns presence into the view's people, title and
layout. It never measures distance.

## Interface

```ts
import { useMeeting } from "../../hooks/use-meeting";

const meeting = useMeeting(cohortId); // Meeting | null
```

- `selectMeeting(presence)`: you first, then the roster in the order they
  arrived. `title` is `"Nearby"` under proximity hearing and the space's
  name under room hearing (`spaceNameOf`, so the key for an unnamed space).
  `hearing` is `room` or `proximity`. `null` before `welcome` or while the
  roster is empty, so you see nothing alone in a room.
- `meetingParticipantOf(participant)`: name (`"Campus member"` when world
  has none), initials, and a tone hashed from the user id, so a person keeps
  one colour however the list changes.
- `visibleMeetingLayout(layout, meeting)`: the grid only for the encounter
  it was opened in, and no focus on somebody who walked away.
- `splitAtCap(items, cap)`: the shown items and how many more.
- `tileVideoLayer(layout, participantId)`: the camera layer a remote tile
  needs: `low` in the strip and beside a focus, `medium` in an equal grid,
  `high` for the focused tile. `useVideoDemandRef` asks for it while the
  tile is mounted.

All pure; `useMeeting` is the only React seam. It selects stable
presence references with `useShallow` and derives with `useMemo`: a selector
that built a fresh object would loop `useSyncExternalStore`.

## Tests

```bash
pnpm vitest run --project=unit features/campus/services/meeting
pnpm eval:proximity
```
