# Campus media session

This module owns browser camera, microphone, and speaker state for one campus
route. It is intentionally separate from signaling and media transport.

The route-scoped provider owns capture resources. UI components consume Zustand
selectors, while a `MeetingMediaTransport` receives local publication changes
and supplies remote publications. The production transport is a no-op until the
backend signaling/SFU integration is implemented.

Selected camera, microphone, and speaker IDs are remembered in browser local
storage. Capture intent is not persisted: every route session starts with both
input sources off and does not call `getUserMedia()` until the user explicitly
turns one on. Turning either input off invalidates pending acquisition, stops
and removes its track, and removes its local publication. Device preferences
stay client-owned when a backend transport is added.

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

User-initiated commands (`toggleSource`, `selectInputDevice`, and
`chooseAudioOutput`) resolve to the `MediaSessionErrorCode` that the action
produced, or `null` on success. UI callers use that value to decide on
feedback, so they never have to diff state before and after a command.

Tests that need controlled state may inject a store through
`MediaSessionProvider`. Production UI should use
`CampusMediaSessionProvider`.

## Invariants

- Every route session starts camera and microphone capture off.
- Missing, malformed, or inaccessible device preferences use system defaults.
- Camera and microphone off stop and remove their track and local publication.
- Re-enabling a source reacquires its remembered device.
- Camera and microphone acquisition fail independently.
- Input replacement retains the current track until its replacement succeeds.
- A source that failed with `device-unavailable` becomes retryable again as
  soon as discovery lists a device of its kind. A selection that is no longer
  listed is dropped, so the retry uses the system default.
- Permission, unreadable, and unsupported failures are not cleared by
  discovery. Only a new user action clears them.
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
- Persisted camera, microphone, and speaker selections.
- Fresh enablement consent for every route session.
- Camera and microphone hard release.
- Transactional input switching.
- Local and remote publication registries.
- Source-aware publication rendering.
- Meeting controls, preview, and participant-tile integration.
- A transport interface ready for a future backend adapter.
- Permission recovery: per-source failure codes, settings-based retry, and
  device-unavailable recovery on discovery
  (`docs/media-permission-recovery-plan.md`).

Remaining:

1. Reset disconnected selections even when their capture source is off.
2. Prove camera and screen publication coexistence in registry coverage.
3. Migrate the production store to `createDeviceCatalog`.
4. Add the signaling/SFU transport adapter.
5. Add screen capture as a separate module in a future worktree.

## Worktree ownership

`media-session-store.ts` is the main integration hotspot. Only one worktree
should modify it at a time.

- Preference correctness should stay within
  `media-device-preferences.ts` and its store-level behavior tests.
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

Verified on 2026-10-02:

- Unit suite: 56 test files and 388 tests passed.
- Lint, typecheck, Prettier check, and production build passed.
- The browser privacy indicator still requires manual verification because unit
  tests cannot observe browser or operating-system chrome.

Run:

```sh
pnpm exec vitest run --project=unit
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
```
