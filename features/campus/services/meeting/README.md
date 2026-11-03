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
- `meetingTiles(meeting, sharerIds, isSharing)`: one tile per person, after a
  tile for each share by someone else in the meeting, after the member's own
  share while they have one. A share's id is `screen:<participant id>`, so it
  focuses apart from its owner's camera.
- `visibleMeetingLayout(layout, encounter, tiles)`: the grid only for the
  encounter it was opened in, and no focus on a tile that is gone.
- `splitAtCap(items, cap)`: the shown items and how many more.
- `tileVideoLayer(layout, tileId)`: the video layer a remote tile
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

## Layout

Every tile is 16:9 in every view: the strip, the equal grid, the rail and the
focused stage. `layout` animates with `scale`, so one ratio keeps that scale
uniform and the content never stretches. A view that needs another ratio brings
the stretch back.

- `meetingGridShape(tileCount)`: columns and rows for the equal grid,
  `ceil(sqrt(n))` columns. `meeting-tiles.module.css` fits the tiles to the area
  with container units, and a short last row is centred.
- Focus keeps the tiles flat siblings, with the rail in flow and the stage
  absolute. A wrapper around the rail would remount its tiles and re-attach
  their video.
- The rail and stage centre as a pair, so a wide window's spare width sits
  outside them, not between them.
- The strip's tray is its own layer, growing out from behind the tiles once they
  land. Painted on the section, it would flash at the grid's full size as the
  view closes.
