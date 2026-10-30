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
  connected, so pre-join never publishes. Production uses
  `noopMeetingMediaTransport` until proximity audio is wired in.

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

### Adding a source (screen sharing)

Add a separate capture module that publishes a `screen` publication. It
coexists with `camera`; it does not replace it.

### Rules

- Every Presence Session starts with camera and microphone off; capture
  intent is never persisted, only device IDs.
- Stored device IDs are untrusted: `media-device-preferences.ts` reads them
  with `parseJson` and falls back to the defaults. A new stored field gets a
  schema entry before anything reads it.
- Nothing reaches the transport before `connect`.
- Turning a source off stops and removes its track and publication.
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
