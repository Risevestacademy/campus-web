# Presence Session

Owns one browser document's joined presence in one cohort: Admission plus the
cohort media session. `app/campus/[id]/layout.tsx` mounts it once per cohort
(through `PresenceSession`), so it survives client navigation between pre-join,
the map, the meeting view, and Cohort Administration. A reload, other cohort,
or any route outside `/campus/[id]` starts a new session. A second tab on the
same cohort never starts one; see [Presence Tab](#presence-tab).

## Interface

- `PresenceSessionProvider`: creates the admission store, the media store, and
  the Presence Tab, and follows the tab's status.
- `useAdmission(selector)`: `pendingDestination`, `admitted`, `grantEntry`,
  `completeEntry`, `clear`.
- `usePresenceTab()`: `status`, `claim`, `takeOver`.
- `AdmissionProvider`, `PresenceTabProvider`: inject a store or tab for tests.

`components/presence-session.tsx` adds the session's `RemoteAudioOutput`;
`components/presence-session-gate.tsx` admits an exact grant and connects the
transport.

## Modules

| Module                          | Owns                                            |
| ------------------------------- | ----------------------------------------------- |
| `admission-store.ts`            | pending destination and admitted flag           |
| `presence-tab.ts`               | which tab holds the cohort, over injected ports |
| `browser-presence-tab.ts`       | Web Locks, `BroadcastChannel`, wake events      |
| `follow-presence-tab.ts`        | ends or restarts media and Admission on status  |
| `presence-session-provider.tsx` | per-cohort store creation and media composition |

## Presence Tab

A browser holds one Presence Session per cohort. The tab holding it owns the
Web Lock `campus-presence:<cohortId>`; tabs on other cohorts are unaffected.

| Status       | Meaning                   | UI                                    |
| ------------ | ------------------------- | ------------------------------------- |
| `checking`   | first probe pending       | pre-join renders nothing              |
| `vacant`     | no tab holds the cohort   | device setup and Join                 |
| `elsewhere`  | another tab holds it      | Use here / Back to campuses           |
| `held`       | this tab holds it         | the cohort pages                      |
| `taken-over` | another tab moved it here | the same choice, in place of the page |

- Join claims the lock only if it is free, so a tab that loses the race
  never connects. Use here steals it; the old tab's lock request rejects,
  and that tab ends its session in place (capture stopped, transport
  disconnected, Admission cleared).
- Probes only read (`locks.query()`). A notice on the cohort's
  `BroadcastChannel` or a wake event (`visibilitychange`, `focus`,
  `pageshow`) triggers one. A closed or crashed holder sends no notice, so
  the other tab sees the cohort free when the member returns to it.
- Use here joins with camera and microphone off.

## Session Renewal

The auth feature's Session Renewal keeps the access token alive while a cohort
page is open, so a token refresh never leaves the page. Only a cold load with
lapsed access (a wake after expiry, before renewal finishes) still goes through
`/session/refresh`, which is outside `/campus/[id]` and ends the session.

## Rules

- Admission is workflow state, never authorization; server checks run first.
- Never persist it in cookies, storage, or the URL.
- Only an exact granted destination admits.
- The Presence Tab coordinates tabs and never authorizes. Without Web Locks
  (an insecure context or an old browser) every tab joins as before.

## Tests

```bash
pnpm vitest run --project=unit \
  features/campus/services/presence-session \
  features/campus/components/presence-session.test.tsx \
  features/campus/components/presence-session-gate.test.tsx \
  features/campus/components/pre-join-presence-tab.test.tsx \
  features/campus/components/presence-tab-choice.test.tsx
pnpm eval:presence-tab
```
