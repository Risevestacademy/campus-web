# World Session

One cohort's connection to world, the realtime service behind the campus map.
The Presence Session creates one per cohort and holds it across pages, so the
member stays on everyone's map from the meeting view or Cohort
Administration too.

## Interface

```ts
const world = createWorldSession({
  url,
  movement, // movementFor(cohortId)
  presence, // presenceFor(cohortId)
  refreshSession, // the shared refresh port (core/session)
  captureEvent, // ([name, properties]) => capture
  onOutcome, // once per terminal outcome; async work owns its ordering
  onMessage, // optional: (message, presence) after presence applies each frame
  onRemoteParticipantsCleared, // optional: (presence) after a close clears them
  createSocket,
  logger,
  isOnline, // browserIsOnline: ports for offline-aware scheduling
  subscribeToWake, // subscribeToBrowserWake: recovery on wake
});

world.connect(); // from idle only
world.reconnect(); // the member's press: also after a stop, fresh budget
world.rejoin(); // live sessions only: fresh socket so World resends its call
world.close(); // ends the socket and empties the map
useSyncExternalStore(world.subscribe, world.getStatus);
```

In React, `useWorldSession()` gives `status`, `connect` and `reconnect` under
`WorldSessionProvider`.

- Every parsed frame goes to `presence.apply`, which rebuilds from each
  `snapshot`, so a reconnect never duplicates an avatar.
- `onMessage` then gets the same frame with the presence it produced. The
  Presence Session passes proximity audio's `applyWorldMessage`, so a
  `nearby` frame reaches subscriptions in the same task, and its
  `applyPresence` as `onRemoteParticipantsCleared`.
- `connect()` and `reconnect()` bind movement to the active client's sender,
  only when they open a socket: `reconnect()` on a live or retrying session
  does nothing, so movement keeps its `stepMs`. Constructing a discarded React
  Strict Mode session cannot steal that binding.
- Every recoverable close clears the remote participants (yourself and the
  authoritative map stay), so a drop never leaves frozen stand-ins.
- Outcomes that leave the Presence Session empty the map, then reach
  `onOutcome` once. `gave-up` and `stop` retain the map and local member for
  the in-place Reconnect control while remote participants remain cleared.
- `connect()` never undoes a stop. Each cohort page mounting
  `PresenceSessionGate` calls it, so after `entered-elsewhere`, `gave-up` or
  `stop` only `reconnect()` opens a socket: Use here, or Reconnect.

## Modules

| Module                       | Owns                                                        |
| ---------------------------- | ----------------------------------------------------------- |
| `world-session.ts`           | the realtime client composed with presence and analytics    |
| `realtime-analytics.ts`      | the analytics events for each client event (pure)           |
| `browser-world-session.ts`   | browser adapters: socket URL, `WebSocket`, PostHog, console |
| `world-session-provider.tsx` | `WorldSessionProvider`, `useWorldSession`                   |

## Analytics

| Event                  | Properties                 | When                             |
| ---------------------- | -------------------------- | -------------------------------- |
| `realtime.connected`   | `reconnect`                | `welcome` and `snapshot` arrived |
| `realtime.reconnected` | `attempts`                 | that connect followed a drop     |
| `realtime.closed`      | `code`, `reason`, `action` | every close but `close()`'s own  |
| `realtime.gave_up`     | `attempts`                 | ten attempts in a row failed     |

`reason` is one of `CLOSE_REASONS` (`core/realtime/close-codes.ts`) or
`unknown`, never the server's text.

## Tests

```bash
pnpm vitest run --project=unit features/campus/services/world-session
pnpm eval:realtime
pnpm eval:privacy
```
