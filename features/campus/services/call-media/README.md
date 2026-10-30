# Call media

Who you hear, from World. World decides the room (`call`) and its hearing;
presence keeps who you meet (`meetingRoster`). This module joins that room,
subscribes only the roster's microphones, and sets each one's gain: full
under room hearing, from distance under proximity hearing. It is the media
session's `MeetingMediaTransport`, so capture stays in the media session.

## Interface

```ts
const session = createCallMediaSession({
  now,
  pinMediaUrl,
  recordFirstAudioMilliseconds,
  roomTransport,
});

session.applyWorldMessage(message, presence); // every parsed World frame
session.applyPresence(presence); // presence that changed without a frame
```

The Presence Session uses `createBrowserCallMediaSession()`, which binds
`pinMediaUrl` to `NEXT_PUBLIC_MEDIA_URL`, `now` to `performance.now`, first
audio to PostHog, and the LiveKit adapter as `roomTransport`.

- `connect(callbacks)` / `handleLocalPublicationChange(change)`: the media
  session's transport seam. Only the microphone reaches the room.
- `applyWorldMessage(message, presence)`: a `call` World can hear
  (`hearingOf`) swaps rooms; `call: null` or a hearing added later leaves.
  `snapshot`, `joined`, `left`, `moved`, `moveResult`, `nearby` and
  `spaceChanged` reapply subscriptions and gains in the
  same task. `applyPresence` does the same for presence a World close
  emptied, so nobody stays audible while World cannot say who is near.
- `MeetingRoomTransport` (`contracts.ts`): joins one room with
  `{ url, token }` and returns a `MeetingRoomConnection` that subscribes by
  participant id, publishes local changes, and disconnects.

## Modules

| Module                              | Owns                                                      |
| ----------------------------------- | --------------------------------------------------------- |
| `call-media-session.ts`             | call lifecycle, subscription policy, gain, status, timing |
| `livekit-meeting-room-transport.ts` | one LiveKit `Room` as a `MeetingRoomConnection`           |
| `browser-call-media-session.ts`     | production composition: media host pin, clock, analytics  |

## LiveKit adapter

- The `Room` is built after the session pins the host, and joins with
  `autoSubscribe: false` and `maxRetries: 3` (three join attempts). Listeners
  register before `connect`.
- Identity is `<userId>:<anything>`; anything else is never subscribed.
- Only microphone publications of the asked-for ids subscribe. Camera, screen
  and unknown sources stay unsubscribed. The first subscribed microphone
  reports first audio, once per room.
- It publishes copies of the member's microphone, never the store's track:
  LiveKit can stop a track it fails to publish. A device switch swaps the copy
  in place; turning off unpublishes it. Changes run in order.
- `removed` follows an unsubscribe or unpublish. A leave and a full reconnect
  unpublish every track first, so they need nothing more.
- `connect` rejects once `signal` aborts and leaves the half-joined room.
  `disconnect` always settles, stops every copy, and reports no drop.
  Microphone changes still queued then never clone.
- `livekit-client` loads only through `services/livekit/livekit-client.ts`.

## Rules

- Audio only. Camera and screen never publish or subscribe.
- Subscribed ids are presence's `meetingRoster`: room mates under room
  hearing, known `nearby` otherwise, never you.
- Gain is `1` under room hearing: everyone in the space hears everyone, and
  nothing leaks in or out. Under proximity hearing it is
  `max(0, 1 - distance / audibleRadius)` in tiles; an unknown position or a
  zero radius is silent.
- Stepping into another space empties the roster at once (presence clears
  `hearing`), so audio cuts at the threshold before World's next call
  arrives.
- The old room finishes disconnecting before the next one joins. A call that
  changes mid-join aborts it and disconnects whatever it returned.
- `MeetingRoomConnection.disconnect` is idempotent. It is still called after
  the room drops on its own, so local tracks are always released.
- The token stays inside this session (the latest call and the join that
  uses it): never in callbacks, store state, logs or analytics. A call that
  arrives before `connect` joins once the media session connects.
- `callAudioStatus`: `connecting`, then `connected` before the first gains;
  `idle` after a leave;
  `unavailable` when the host is not pinned, the join fails, the room
  disconnects on its own, or a microphone change fails. Remote publications
  and gains clear in every case.
- First-audio time is measured only for calls that arrive while the roster
  is not empty, from `call` to the room's first remote microphone, and is
  reported with the call's hearing.

Remote video is not supported yet.

`RemoteAudioOutput` follows each participant's gain outside React, so a gain
change never detaches the audio. A participant with no gain plays silent.
While the status is `unavailable`, `CallAudioFeedback` (once per Presence
Session) shows a warning toast, "Audio couldn't connect", with Try again.
`retry()` rejoins the latest call in place; if LiveKit refuses that grant
(`RoomAccessDeniedError`, usually an expired token) it calls `refreshCall`
(`world.rejoin()`), and World answers with a fresh call. If World is not
connected, `refreshCall` returns false and the status goes back to
`unavailable`. Only the member's
retry refreshes, never a failure on its own. It
closes when audio recovers or the session ends. The media controls never grow
to explain it.

## Analytics

| Event                          | Properties                  | When                                       |
| ------------------------------ | --------------------------- | ------------------------------------------ |
| `campus.proximity_audio_ready` | `first_audio_ms`, `hearing` | first roster microphone of a measured call |

`first_audio_ms` runs from a `call` that arrives with somebody already in
`meetingRoster` to the first remote microphone subscribed. Two limits:

- The first person into a room is never measured: their roster is empty when
  their `call` arrives, even if someone joins later.
- Muted mates stretch it: a room where everyone is muted can report minutes.

Compare room and proximity latency only with both in mind.

## Tests

```bash
pnpm vitest run --project=unit features/campus/services/call-media
pnpm eval:proximity-audio
pnpm eval:privacy
```

The eval drives real frames through presence, this session and the adapter
over `testing/fake-livekit.ts`. Threshold: 7/7 scenarios, every roster
change applied in the same task, and no subscription outside the latest
`meetingRoster`.
