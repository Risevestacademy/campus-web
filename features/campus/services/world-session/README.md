# World Session

One cohort's connection to world, the realtime service behind the campus map.
The Presence Session creates one per cohort and holds it across pages, so the
member stays on everyone's map from the meeting view or Cohort
Administration too.

## Interface

```ts
const world = createWorldSession({
  url,
  cohortId,
  presence, // presenceFor(cohortId)
  refreshSession, // the shared refresh port
  captureEvent, // ([name, properties]) => capture
  onOutcome, // once per terminal outcome
  createSocket,
  logger,
});

world.connect(); // from idle only
world.reconnect(); // the member's press: also after a stop, fresh budget
world.close(); // ends the socket and empties the map
useSyncExternalStore(world.subscribe, world.getStatus);
```

In React, `useWorldSession()` gives `status`, `connect` and `reconnect` under
`WorldSessionProvider`.

- Every parsed frame goes to `presence.apply`, which rebuilds from each
  `snapshot`, so a reconnect never duplicates an avatar.
- Every terminal outcome empties the map, then reaches `onOutcome` once.
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
| `realtime.connected`   | `cohort_id`, `reconnect`   | `welcome` and `snapshot` arrived |
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
