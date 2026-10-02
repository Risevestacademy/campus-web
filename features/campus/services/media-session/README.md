# Campus media session

This module owns browser camera, microphone, and speaker state for one campus
route. It is intentionally separate from signaling and media transport.

The route-scoped provider owns capture resources. UI components consume Zustand
selectors, while a `MeetingMediaTransport` receives local publication changes
and supplies remote publications. The production transport is a no-op until the
backend signaling/SFU integration is implemented.

Camera and microphone intent is remembered in browser local storage and
defaults to off when no valid preference exists. Startup acquires only enabled
sources. Camera off stops and removes the camera track so the browser can
release the physical device; microphone off remains a soft mute after capture
has started. These preferences stay client-owned when a backend transport is
added.

Media is modeled as source-aware publications rather than one stream per
participant. Remote publications are indexed by participant and source so a
publication update only invalidates the matching tile selector. Camera and
microphone are supported now; a later screen-sharing session can add a `screen`
publication without replacing the transport or registry.

## Interface

Callers use three entry points:

- `CampusMediaSessionProvider` owns the media session for one campus route.
- `useMediaSession(selector)` gives UI callers selected state and commands
  without exposing provider or store implementation details.
- `MeetingMediaTransport` describes local publication changes and remote
  publication subscriptions for a future signaling/SFU adapter.

Tests that need controlled state may inject a store through
`MediaSessionProvider`. Production UI should use
`CampusMediaSessionProvider`.

## Invariants

- Missing, invalid, or inaccessible preferences default camera and microphone
  intent to off.
- Camera off stops and removes its track and local publication.
- Microphone off soft-mutes an existing track.
- Camera and microphone acquisition fail independently.
- Input replacement retains the current track until its replacement succeeds.
- Browser tracks remain client-owned and route-scoped.
- Publications have stable IDs and are indexed by participant and source.
- A `screen` publication can coexist with a `camera` publication.
- Leaving the dynamic campus route stops browser capture.

## Seams and adapters

`MeetingMediaTransport` is currently a provisional seam. Its only production
adapter is `noopMeetingMediaTransport`; the seam becomes concrete when a
signaling/SFU adapter is implemented. That adapter should translate
publication events without owning browser capture or preferences.

`createMediaSessionStore` accepts browser media and transport dependencies so
tests can exercise the same interface as production callers.

`createDeviceCatalog` implements serialized refresh, stale-result protection,
last-good retention, and reset invalidation. The production store does not yet
use this coordinator and still calls `discoverMediaDevices` directly.

## Progress

Implemented:

- Route-scoped camera, microphone, and speaker state.
- Persisted camera and microphone intent with default-off startup.
- Camera hard release and microphone soft mute.
- Transactional input switching.
- Local and remote publication registries.
- Source-aware publication rendering.
- Meeting controls, preview, and participant-tile integration.
- A transport interface ready for a future backend adapter.

Remaining:

1. Reject partially malformed preference records as invalid.
2. Reset disconnected selections even when their capture source is off.
3. Prove camera and screen publication coexistence in registry coverage.
4. Migrate the production store to `createDeviceCatalog`.
5. Add the signaling/SFU transport adapter.
6. Add screen capture as a separate module in a future worktree.

## Worktree ownership

`media-session-store.ts` is the main integration hotspot. Only one worktree
should modify it at a time.

- Preference correctness should stay within
  `media-control-preferences.ts` and its store-level behavior tests.
- Device-catalog migration owns `device-discovery.ts`,
  `media-session-store.ts`, device menus, and their acceptance coverage.
- Publication coexistence should remain localized to
  `publication-registry.ts` and registry behavior tests.
- A backend worktree should add a transport adapter at the existing seam.
- A screen-sharing worktree should add a separate capture module and publish a
  `screen` source without treating it as a camera replacement.

Coordinate before changing `contracts.ts`, because capture, rendering,
transport, backend, and screen-sharing work all depend on that interface.

## Verification

Before the `origin/dev` merge, the complete unit suite passed 37 test files and
158 tests. The merged result still requires a new verification baseline.

Run:

```sh
pnpm exec vitest run --project=unit
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
```
