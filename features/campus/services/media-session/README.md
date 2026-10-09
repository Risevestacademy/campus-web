# Campus media session

Owns browser camera, microphone, and speaker state for one campus route, and
the local and remote publications built from it. Signaling and media
transport are not owned here; they plug in at `MeetingMediaTransport`.

## Interface

- `CampusMediaSessionProvider`: one media session per campus route; leaving
  the route stops capture.
- `useMediaSession(selector)`: selected state and commands. Commands
  (`toggleSource`, `selectInputDevice`, `chooseAudioOutput`) resolve to the
  `MediaSessionErrorCode` they produced, or `null`.
- `MeetingMediaTransport`: receives local publication changes, supplies remote
  publications. Production uses `noopMeetingMediaTransport` until the
  signaling/SFU adapter exists.

Tests inject a store through `MediaSessionProvider`.

## Modules

| Module                                                         | Owns                                                      | Seam                     |
| -------------------------------------------------------------- | --------------------------------------------------------- | ------------------------ |
| `contracts.ts`                                                 | the shared types every other module depends on            | none                     |
| `media-session-store.ts`                                       | sources, commands, failures; `createMediaSessionStore`    | browser media, transport |
| `media-session-provider.tsx`, `use-media-session-lifecycle.ts` | route-scoped store, start and stop                        | React context            |
| `device-discovery.ts`                                          | `createDeviceCatalog`: serialized, stale-safe enumeration | `enumerateDevices`       |
| `media-device-preferences.ts`                                  | remembered device IDs                                     | `localStorage`           |
| `publication-registry.ts`                                      | publications indexed by participant and source            | none                     |
| `meeting-media-transport.ts`                                   | the transport seam and its no-op adapter                  | `MeetingMediaTransport`  |

## Contributing

### Adding the backend transport

Add an adapter that satisfies `MeetingMediaTransport` and pass it to
`createMediaSessionStore`. It translates publication events only; it never
owns capture or preferences.

### Adding a source (screen sharing)

Add a separate capture module that publishes a `screen` publication. It
coexists with `camera`; it does not replace it.

### Rules

- Every route session starts with camera and microphone off; capture intent
  is never persisted, only device IDs.
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
