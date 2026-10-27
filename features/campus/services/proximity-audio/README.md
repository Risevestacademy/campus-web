# Proximity audio

Who you hear, from World. World decides the room (`call`) and who is near
(`nearby`); this module joins that room, subscribes only the nearby
microphones, and sets each one's gain from distance. It is the media
session's `MeetingMediaTransport`, so capture stays in the media session.

## Interface

```ts
const session = createProximityAudioSession({
  now,
  pinMediaUrl,
  recordFirstAudioMilliseconds,
  roomTransport,
});

session.applyWorldMessage(message, presence); // every parsed World frame
```

- `connect(callbacks)` / `handleLocalPublicationChange(change)`: the media
  session's transport seam. Only the microphone reaches the room.
- `applyWorldMessage(message, presence)`: a proximity `call` swaps rooms;
  `call: null` or a room-hearing call leaves. `snapshot`, `joined`, `left`,
  `moved`, `moveResult` and `nearby` reapply subscriptions and gains in the
  same task.
- `MeetingRoomTransport` (`contracts.ts`): joins one room with
  `{ url, token }` and returns a `MeetingRoomConnection` that subscribes by
  participant id, publishes local changes, and disconnects.

## Rules

- Audio only. Camera and screen never publish or subscribe.
- Subscribed ids are `nearby` minus you, limited to participants presence
  knows.
- Gain is `max(0, 1 - distance / audibleRadius)` in tiles. An unknown
  position or a zero radius is silent.
- The old room finishes disconnecting before the next one joins. A call that
  changes mid-join aborts it and disconnects whatever it returned.
- The token stays inside this session (the latest call and the join that
  uses it): never in callbacks, store state, logs or analytics. A call that
  arrives before `connect` joins once the media session connects.
- `callAudioStatus`: `connecting`, then `connected`; `idle` after a leave;
  `unavailable` when the host is not pinned, the join fails, the room
  disconnects on its own, or a microphone change fails. Remote publications
  and gains clear in every case.
- First-audio time is measured only for calls that arrive while somebody is
  nearby, from `call` to the room's first remote microphone.

Room-hearing spaces and remote video are not supported yet.

## Tests

```bash
pnpm vitest run --project=unit features/campus/services/proximity-audio
```
