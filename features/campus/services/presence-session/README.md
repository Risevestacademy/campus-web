# Presence Session

Owns one browser document's joined presence in one cohort: Admission plus the
cohort media session. `app/campus/[id]/layout.tsx` mounts it once per cohort
(through `PresenceSession`), so it survives client navigation between pre-join,
the map, the meeting view, and Cohort Administration. A reload, new tab, other
cohort, or any route outside `/campus/[id]` starts a new session.

## Interface

- `PresenceSessionProvider`: creates the admission store, the media store, and
  the Presence Tab, and follows the tab's status.
- `useAdmission(selector)`: `pendingDestination`, `admitted`, `grantEntry`,
  `completeEntry`, `clear`.
- `usePresenceTab()`: `status`, `claim`, `takeOver`.
- `AdmissionProvider`: injects a store for tests.

`components/presence-session.tsx` adds the session's `RemoteAudioOutput`;
`components/presence-session-gate.tsx` admits an exact grant and connects the
transport.

## Modules

| Module                          | Owns                                            |
| ------------------------------- | ----------------------------------------------- |
| `admission-store.ts`            | pending destination and admitted flag           |
| `presence-session-provider.tsx` | per-cohort store creation and media composition |

## Session Renewal

The auth feature's Session Renewal keeps the access token alive while a cohort
page is open, so a token refresh never leaves the page. Only a cold load with
lapsed access (a wake after expiry, before renewal finishes) still goes through
`/session/refresh`, which is outside `/campus/[id]` and ends the session.

## Rules

- Admission is workflow state, never authorization; server checks run first.
- Never persist it in cookies, storage, or the URL.
- Only an exact granted destination admits.

## Tests

```bash
pnpm vitest run --project=unit \
  features/campus/services/presence-session \
  features/campus/components/presence-session.test.tsx \
  features/campus/components/presence-session-gate.test.tsx
```
