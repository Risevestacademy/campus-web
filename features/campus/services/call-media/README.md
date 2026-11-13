# Call media

Who you hear and see, from World. World decides the room (`call`) and its hearing;
presence keeps who you meet (`meetingRoster`). This module joins that room,
subscribes the roster's microphones and the cameras and screens of their tiles on screen,
lets only the roster receive your tracks, and sets each voice's gain: full
under room hearing, from distance under proximity hearing. It is the media
session's `MeetingMediaTransport`, so capture stays in the media session.

## Interface

```ts
const session = createCallMediaSession({
  now,
  pinMediaUrl,
  recordFirstAudioMilliseconds,
  recordFirstVideo,
  recordScreenShareEnded,
  recordScreenShareReady,
  refreshCall,
  roomTransport,
});

session.applyWorldMessage(message, presence); // every parsed World frame
session.applyPresence(presence); // presence that changed without a frame
```

The production session is `withBroadcastListener(callMedia, listener)`: the
space's call and the cohort's broadcast room, fed the same frames and
connected and disconnected together.

The Presence Session uses `createBrowserCallMediaSession()`, which binds
`pinMediaUrl` to `NEXT_PUBLIC_MEDIA_URL`, `now` to `performance.now`, first
audio, first video and screen shares to PostHog, `refreshCall` to `world.rejoin()`, and the
LiveKit adapter as `roomTransport`. `now` times first audio. The adapter times
first video with its own clock, since only it knows when a camera was asked for.

- `connect(callbacks)` / `handleLocalPublicationChange(change)`: the media
  session's transport seam. The microphone and camera reach the room, each
  replayed when a room joins (microphone first). A screen reaches the room it
  was picked in and is never replayed.
- `setVideoDemand(demand)`: the remote cameras and screens on screen and their
  layer, from the media session's tiles. Only the roster's are asked for.
- `applyWorldMessage(message, presence)`: a `call` World can hear
  (`hearingOf`) swaps rooms; `call: null` or a hearing added later leaves.
  `snapshot`, `joined`, `left`, `moved`, `moveResult`, `nearby` and
  `spaceChanged` reapply subscriptions and gains in the
  same task. `applyPresence` does the same for presence a World close
  emptied, so nobody stays audible while World cannot say who is near.
- `MeetingRoomTransport` (`contracts.ts`): joins one room with
  `{ url, token }` and returns a `MeetingRoomConnection` that applies the
  `MeetingAudience` (who you hear, whose cameras and screens you see, and who
  may receive your tracks),
  publishes local changes, and disconnects.

## Modules

| Module                                | Owns                                                      |
| ------------------------------------- | --------------------------------------------------------- |
| `call-media-session.ts`               | call lifecycle, subscription policy, gain, status, timing |
| `livekit-meeting-room-transport.ts`   | one LiveKit `Room` as a `MeetingRoomConnection`           |
| `broadcast-listener.ts`               | the broadcast room's lifecycle beside the space's call    |
| `livekit-broadcast-room-transport.ts` | the broadcast `Room`: listen to every microphone          |
| `livekit-room-join.ts`                | join options, abortable joins, a refused grant            |
| `browser-call-media-session.ts`       | production composition: media host pin, clock, analytics  |

## LiveKit adapter

- The `Room` is built after the session pins the host, with `dynacast` (a
  publisher stops encoding camera layers nobody wants), and joins with
  `autoSubscribe: false` and `maxRetries: 3` (three join attempts). Listeners
  register before `connect`.
- Identity is `<userId>:<anything>`; anything else is never subscribed or
  granted.
- Right after joining it grants nobody, then grants every identity of the
  audience's ids (`setTrackSubscriptionPermissions`), so the SFU refuses
  your tracks to anyone else in the room. It regrants when someone joins the
  room and tells the SFU only when the grant changes.
- Microphones of the audience's ids subscribe, and cameras of its `video`
  ids, each asked for at its layer (`setVideoQuality`, sent only when it
  changes, and again when a camera is subscribed anew, since the SFU forgets a
  track's settings once it unsubscribes). Screens of its `video` ids do the
  same. A share's audio and unknown sources stay unsubscribed. The first
  subscribed microphone reports first audio, once per room.
- Who in the audience is sharing is read from the room and reported whenever it
  changes, before anything subscribes, so a tile can mount and ask for the
  screen. Nobody outside the audience is ever reported.
- A track that arrived while unwanted is handed over once it is wanted again,
  since the SFU may never unsubscribe it and no second event would fire.
- The room's first subscribed camera reports first video once, timed from
  the moment that camera was asked for, with the member's own link quality.
- A subscribed camera or screen that mutes or unmutes is handed over again with
  `enabled` flipped, so a tile never freezes on its last frame. A microphone
  is not: a handover re-attaches its element, which would clip the audio, so
  its `enabled` holds the value from when it subscribed.
- It publishes copies of the member's microphone, camera and screen, each as
  its own source, never the store's track: LiveKit can stop a track it fails to
  publish. A device switch swaps the copy in place; turning off unpublishes
  it. Changes to one source run in order. A screen publishes at LiveKit's
  1080p 15 fps encoding with simulcast on, keeping its content hint.
- A share's first subscriber reports first viewer once per share, timed from
  its publish, so the picker's time is left out.
- `removed` follows an unsubscribe or unpublish of a track it handed over,
  once. A leave and a full reconnect unpublish every track first, so they
  need nothing more.
- `connect` rejects once `signal` aborts and leaves the half-joined room.
  `disconnect` always settles, stops every copy, and reports no drop.
  Microphone and camera changes still queued then never clone.
- `livekit-client` loads only through `services/livekit/livekit-client.ts`.

## Broadcast

World sends `broadcast` after each snapshot (`docs/world-protocol.md`,
"Broadcast"). `createBroadcastListener` joins `call.url` (pinned like a space's
call) with `call.token`, beside the space's call, and stays in it while the
member walks: no other frame touches it.

- A new `broadcast` leaves the room and joins again with its token, even for
  the same room, since World revokes the old token when a role changes. The
  old room finishes leaving first; a join a newer broadcast overtook is aborted
  and whatever it returns is left.
- `null` leaves. So does presence whose `broadcast` a closed socket cleared
  (`applyPresence`); World sends it again after the next snapshot. The web
  never watches (A-3), so there is no watching case.
- A join that fails or a room that drops on its own clears what it carried
  and stays out until World's next `broadcast`. It never touches
  `callAudioStatus`: the space's call is fine.
- The adapter joins with `autoSubscribe: false` and subscribes the microphone
  of every identity World named (`<userId>:<anything>`), already in the room
  or published later. Cameras, screens and anything else stay unsubscribed.
  It publishes nothing; speaking is D-2.
- Microphones reach `onBroadcastPublicationChange`, which the media store keeps
  in `broadcastPublications`, never in the meeting's `remotePublications`, so
  no tile, roster or video demand sees them. Who has an unmuted one there is
  who is speaking: World says a broadcast is on while an audio track is
  published, but a speaker may mute without unpublishing, so a mute or unmute
  hands the microphone over again with `enabled` current. `liveBroadcasts`
  skips muted ones, for the status and for ducking alike.
  Each carries `speakerName`, the display name World signed into the
  speaker's token (`parseParticipantName`: trimmed, 1 to 100 characters, else
  `null`). `BroadcastStatus` prefers presence's name, then this one (an admin
  outside the cohort is in no presence), then "An admin".
- The token stays inside the listener, as a space's call's does.

## Rules

- Your camera publishes while it is on and a call is joined, like your
  microphone. A remote camera or screen subscribes only while its owner is in
  the roster and its tile is on screen, so the compact strip pulls at most
  three.
- A share ends, and capture stops, when the room closes for any reason (a new
  call, a drop, a retry, leaving) or when the roster empties. It comes off the
  room before the room disconnects. A crossing empties the roster first, and
  still reports `room_closed`. A screen picked with no room or an empty roster
  never publishes. Screen permissions are the same roster-only grant as every
  other track; the SFU cannot limit who shares.
- The audience is presence's `meetingRoster`: room mates under room
  hearing, known `nearby` otherwise, never you. An empty roster grants
  nobody.
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
- A refused share never fails the call either: `onScreenShareEnded` reports
  `publish_failed`, and capture stops. A failed take-down reports nothing, since
  its copy stops either way.
- A refused camera never fails the call: video degrades before audio. The
  session reports `onCameraPublishOutcome` after every camera change, including
  replays in a new room, and `false` when a room closes. Changes to one source
  settle in order, so the last report is the latest change's. A failed turn-off
  reports `false`: the copy is stopped either way.
- A failed device swap takes the old copy off the call, so the device the
  member switched away from stops sending.
- First-audio time is measured only for calls that arrive while the roster
  is not empty, from `call` to the room's first remote microphone, and is
  reported with the call's hearing.
- First-video time runs from asking for a camera (its tile is on screen and
  its owner in the roster) to the SFU subscribing it, once per room, with the
  call's hearing and the member's `connection_quality`. A retry is measured
  too, since the time starts at the ask, not at World's call. It is the data
  any later rule for dropping video on a poor link should start from.

`RemoteAudioOutput` follows each participant's gain outside React, so a gain
change never detaches the audio. A participant with no gain plays silent.
While the status is `unavailable`, `CallMediaFeedback` (once per Presence
Session) shows a warning toast, "Audio couldn't connect", with Try again.
While the camera is refused it shows "Your camera isn't reaching the call",
and makes no claim about being heard: the microphone may be off too.
`retry()` rejoins the latest call in place; if LiveKit refuses that grant
(`RoomAccessDeniedError`, usually an expired token) it calls `refreshCall`
(`world.rejoin()`), and World answers with a fresh call. If World is not
connected, `refreshCall` returns false and the status goes back to
`unavailable`. Only the member's
retry refreshes, never a failure on its own. It
closes when audio recovers or the session ends. The media controls never grow
to explain it.

## Analytics

| Event                          | Properties                                         | When                                       |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------ |
| `campus.proximity_audio_ready` | `first_audio_ms`, `hearing`                        | first roster microphone of a measured call |
| `campus.meeting_video_ready`   | `first_video_ms`, `hearing`, `connection_quality`  | first camera a room subscribes             |
| `campus.screen_share_ready`    | `first_viewer_ms`, `hearing`, `connection_quality` | first viewer of a share                    |
| `campus.screen_share_ended`    | `reason`, `duration_ms`, `hearing`                 | end of a share that reached a room         |

Screen share events never carry the window's title or the surface's label; the
capture code reads neither.

## Tests

```bash
pnpm vitest run --project=unit features/campus/services/call-media
pnpm eval:proximity-audio
pnpm eval:meeting-video
pnpm eval:screen-share
pnpm eval:privacy
```

The eval drives real frames through presence, this session and the adapter
over `testing/fake-livekit.ts`. Thresholds: `proximity-audio` 8/8,
`meeting-video` 5/5 and `screen-share` 7/7 scenarios, every roster change applied
in the same task, no subscription or grant outside the latest `meetingRoster`,
and no capture left running.
