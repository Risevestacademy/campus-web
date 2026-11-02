# Campus media session

Owns browser camera, microphone, and speaker state for one Presence Session,
and the local and remote publications built from it. Signaling and media
transport are not owned here; they plug in at `MeetingMediaTransport`.

## Interface

- `MediaSessionProvider`: one media session per Presence Session.
  `PresenceSessionProvider` creates the store above the Join Gate and every
  cohort page and runs `useMediaSessionLifecycle`; leaving the cohort stops
  capture and disconnects.
- `useMediaSession(selector)`: selected state and commands. Commands
  (`toggleSource`, `selectInputDevice`, `chooseAudioOutput`) resolve to the
  `MediaSessionErrorCode` they produced, or `null`.
- `connect()`: joins the transport after Admission. Idempotent; replays
  publications chosen on pre-join as `added`. `stop()` disconnects and resets
  `callAudioStatus`, `remoteAudioGains` and `remotePublications`.
- `MeetingMediaTransport`: `connect(callbacks)` returns a disconnect function.
  The transport picks its own rooms and reports remote publication changes,
  per-participant `remoteAudioGains` (0 to 1) and a safe `callAudioStatus`
  (`idle`, `connecting`, `connected`, `unavailable`); no room, URL or token
  reaches the store. `handleLocalPublicationChange` is called only while
  connected, so pre-join never publishes. `setVideoDemand(demand)` names
  the remote cameras and screens on screen and their layer, connected or not. Production
  uses the call-media session; `noopMeetingMediaTransport` is the default.
- `cameraPublishFailed`: the call refused the member's latest camera change
  (`onCameraPublishOutcome`); it follows each outcome, and `stop()` clears it.
- `demandVideo(participantId, source, layer)`: a tile showing a remote camera
  or screen asks for it and gets back the function that lets it go. Requests
  settle in a microtask into one `VideoDemand` (the largest layer per source and
  participant), so a tile changing size never drops its video on the way.
- `toggleScreenShare()`: opens the browser's picker, or stops the share. Call it
  from the member's click, since the browser opens the picker only then. It does
  nothing until `connect`. `screenShare` holds its `status` (`idle`, `requesting`,
  `sharing`) and how the last share went (`outcome`), cleared by the next start.
  While sharing it also holds the `publication`, which the member's Own screen
  tile reads, so that tile cannot outlive the share.
- `remoteScreenShares`: who in the roster is sharing, subscribed or not, so a
  tile can mount and ask for the screen.

Tests inject a store through `MediaSessionProvider`.

## Modules

| Module                                                         | Owns                                                      | Seam                     |
| -------------------------------------------------------------- | --------------------------------------------------------- | ------------------------ |
| `contracts.ts`                                                 | the shared types every other module depends on            | none                     |
| `media-session-store.ts`                                       | sources, commands, failures; `createMediaSessionStore`    | browser media, transport |
| `media-session-provider.tsx`, `use-media-session-lifecycle.ts` | session-scoped store, start and stop                      | React context            |
| `device-discovery.ts`                                          | `createDeviceCatalog`: serialized, stale-safe enumeration | `enumerateDevices`       |
| `media-device-preferences.ts`                                  | remembered device IDs                                     | `localStorage`           |
| `publication-registry.ts`                                      | publications indexed by participant and source            | none                     |
| `video-demand.ts`                                              | the remote videos on screen, settled into one demand      | `setVideoDemand`         |
| `screen-share.ts`                                              | screen capture: picker, its failures, the track's end     | `getDisplayMedia`        |
| `meeting-media-transport.ts`                                   | the transport seam and its no-op adapter                  | `MeetingMediaTransport`  |

## Contributing

`MeetingMediaTransport.retry()` (the store's `retryCallAudio()`) tries the
call again after it became `unavailable`; it reaches the transport only while
connected.

### Adding the backend transport

Add an adapter that satisfies `MeetingMediaTransport` and pass it to
`createMediaSessionStore`. It translates publication events only; it never
owns capture or preferences. Its disconnect must close every peer connection
(`RTCPeerConnection.close()`). Do not rely on `beforeunload`; the server must
expire presence that stops sending heartbeats.

### Screen share

`screen-share.ts` captures the screen and sends one `screen` publication
through the transport. It coexists with `camera`; it does not replace it.

- Video only, at most 1080p and 15 fps, hinted `detail` so text stays sharp.
- Every end goes through `end(reason)`, which stops the track and sends
  `removed` with its `endReason`. It is safe to call with nothing shared, so the
  transport reports `onScreenShareEnded` whenever the call cannot carry a share.
- Ending also invalidates an open picker: a screen picked after that is stopped
  and never published.
- Dismissing and denying the picker raise the same `NotAllowedError`, so neither
  shows anything. A block in the operating system's settings raises it too, and
  only Chromium's message tells it apart (`capture_blocked`, which says where to
  allow it). Other browsers stay silent there.

### Rules

- Every Presence Session starts with camera and microphone off; capture
  intent is never persisted, only device IDs.
- Stored device IDs are untrusted: `media-device-preferences.ts` reads them
  with `parseJson` and falls back to the defaults. A new stored field gets a
  schema entry before anything reads it.
- Nothing reaches the transport before `connect`.
- Turning a source off stops and removes its track and publication.
- `stop()` ends a share before it disconnects, so the transport hears why.
- Input replacement keeps the current track until the new one succeeds.
- Camera and microphone fail independently; permission failures clear only on
  a new user action.
- Device discovery runs one enumeration at a time and the newest list wins.
- `media-session-store.ts` is the integration hotspot and `contracts.ts` the
  shared interface: coordinate before changing either.
- Comment only a non-obvious why.

## Tests

```bash
pnpm vitest run --project=unit features/campus/services/media-session
```

The browser privacy indicator needs a manual check; tests cannot observe it.
