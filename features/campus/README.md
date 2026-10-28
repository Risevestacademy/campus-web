# Campus

Owns the member-facing Cohort chooser, the Campus Shell (rail and sidebar),
and the Active Campus media UI inside it. Admin catalogues and pages belong to
`admin`, access decisions to `auth`, and the participant list to `roster`.

## Interface

| Entry         | Imported by           | Exports                                                                                                                                                                |
| ------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`    | routes                | `CohortChooser`, `CampusShell`, `ActiveCampus`, `PresenceSession`, `PresenceSessionGate`, `PreJoinPresenceTab`, `PresenceDock`, `VisualsDisplay`, `ConnectionCheck`, … |
| `document.ts` | `app/layout.tsx` only | `sidebarInitializerScript` (sizes the sidebar before hydration)                                                                                                        |

```tsx
<CampusShell
  AccountMenu={AccountMenu}
  administrationPanel={adminSidebar}
  OverviewPanel={CampusOverviewPanel}
  cohortId={id}
  initialSidebarMode="admin" // Cohort Administration only
>
  <ActiveCampus
    cohortId={id}
    viewModel={activeCampusViewModel}
    zoomControls={<CampusZoomControls />} // from campus-world
  >
    {children}
  </ActiveCampus>
</CampusShell>
```

`app/campus/[id]/layout.tsx` mounts one `PresenceSession` per cohort, keyed by
cohort ID, above the Join Gate and every cohort page. It owns admission, the
media session, and the remote audio output, so moving between the map, the
meeting view, and Cohort Administration keeps the call. Join grants one exact
pending destination before navigating; `PresenceSessionGate` admits an exact
match and connects the transport. Reloads, other cohorts, and any navigation
outside `/campus/[id]` start a new session that returns through pre-join. A
browser holds one Presence Tab per cohort: a second tab on the same cohort
offers Use here instead of Join, and `PreJoinPresenceTab` keeps device setup
from capturing until no other tab holds it.

Every joined route group renders `PresenceSessionGate`; every one except the
map renders `PresenceDock`. `tests/evals/presence-session-routes.eval.test.ts`
enforces both.

The active-campus route supplies the cohort id and `ActiveCampusViewModel`, whose
`viewer` is still an explicit placeholder; leaf media UI must not create
substitute domain state. The meeting view reads world: `MeetingOverlay` asks
`useProximityMeeting(cohortId)` for you plus whoever presence's `nearby` names
(known participants only, in the order they came near), and shows nothing when
nobody is. A grid remembers the `encounter` it opened for, so the next
encounter starts on the map (`visibleMeetingLayout`). Meeting layout and sidebar-opening
transitions belong to `CampusViewProvider`, whose intent actions preserve the
rule that an expanded meeting and open sidebar cannot coexist.
`useProximityViewShown` sends `campus.proximity_view_shown` (no properties)
each time the meeting view mounts, which is once per encounter.

Routes pass Auth-, Admin-, Feedback-, and Roster-owned UI in as props, because Campus may
not import those features.

## Modules

| Module                                                                                                                              | Owns                                                                                                                                          | Seam                                    |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `components/cohort-chooser.tsx`, `cohort-card.tsx`, `types/`                                                                        | member Cohort selection from session memberships                                                                                              | none                                    |
| `components/campus-shell/`                                                                                                          | rail (with a Privacy choices item), sidebar, panel switching, collapse, and the layer that places the Feedback popup                          | `core/analytics/consent`                |
| `store/`, `hooks/use-sidebar-state.ts`                                                                                              | sidebar open, panel, and mode, persisted in `localStorage`                                                                                    | `localStorage`                          |
| `schemas/sidebar-preferences.schema.ts`                                                                                             | parsing stored sidebar preferences; each bad field falls back alone                                                                           | `parseJson`                             |
| `store/feedback-panel-store.ts`                                                                                                     | whether the Feedback popup is open (not persisted)                                                                                            | none                                    |
| `components/` (media UI)                                                                                                            | `ActiveCampus`, control bar, media toggles and settings, meeting header, tiles, view switch                                                   | `useMediaSession`, `CampusViewProvider` |
| `services/presence-session/`, `components/presence-session*`, `components/*presence-tab*`                                           | per-cohort admission, Presence Tab, session composition, gate ([README](services/presence-session/README.md))                                 | `useAdmission`, `usePresenceTab`        |
| `components/presence-dock.tsx`, `remote-audio-output.tsx`, `hooks/use-call-audio-feedback.ts`                                       | compact controls on non-map pages; one audio mix and one call-audio failure toast per session                                                 | `useMediaSession`                       |
| `services/proximity-meeting/`, `hooks/use-proximity-meeting.ts`, `components/meeting-overlay.tsx`                                   | the meeting view's people from presence `nearby`: order, names, initials, tones, caps, and which layout shows                                 | `useProximityMeeting`                   |
| `services/media-session/`                                                                                                           | capture, devices, publications ([README](services/media-session/README.md))                                                                   | `MeetingMediaTransport`                 |
| `services/proximity-audio/`                                                                                                         | joining World's call room over LiveKit, nearby-only audio subscriptions and distance gain ([README](services/proximity-audio/README.md))      | `MeetingRoomTransport`                  |
| `services/microphone-level/`, `hooks/use-microphone-level-ref.ts`                                                                   | the member's own microphone level, filling the mic glyph ([README](services/microphone-level/README.md))                                      | `useMicrophoneLevelRef`                 |
| `services/livekit/`                                                                                                                 | the one dynamic `livekit-client` import, shared by the connection check and proximity audio                                                   | `loadLivekitClient`                     |
| `services/world-session/`, `components/world-connection-status.tsx`                                                                 | the cohort's world socket feeding the map; its quiet status and Reconnect ([README](services/world-session/README.md))                        | `useWorldSession`                       |
| `services/connection-check/`, `schemas/connection-check.schema.ts`, `hooks/use-connection-check.ts`, `components/connection-check*` | the Join Gate's pre-join connection check: world's token, the media host pin, the LiveKit run ([README](services/connection-check/README.md)) | `useConnectionCheck`                    |
| `testing/`                                                                                                                          | media session, Presence Tab, world session and LiveKit test utilities                                                                         | none                                    |

Flow: component → `useMediaSession(selector)` or sidebar hooks → store →
browser media or `localStorage`.

## Contributing

### Adding a rail panel

1. Add the id to `SIDEBAR_PANEL_IDS` in `store/sidebar-preferences.ts`;
   `SidebarPanelId` and the stored-preferences schema follow.
2. Add the rail item to `components/campus-shell/rail-items.ts`.
3. Panel content owned by another feature arrives as a `CampusShell` prop
   (like `OverviewPanel`); until it exists the shell shows a coming-soon
   panel.

### Adding a media control

1. Component in `components/`; read state with a narrow
   `useMediaSession(selector)`.
2. Call a store command; its returned `MediaSessionErrorCode` drives feedback
   through `media-error-feedback.ts`.
3. New capture behaviour goes in `services/media-session/`, not the component.

### Rules

- Import no other feature.
- The root layout imports `document.ts` only; never the `index.ts` barrel.
- Sidebar state is read through `hooks/use-sidebar-state.ts` and written
  through `CampusViewProvider` intent actions; the provider alone coordinates
  sidebar writes with meeting layout.
- Do not add a meeting lock control until a real meeting capability owns it.
- Cohort Administration opens in Administration mode; Active Campus restores
  the stored mode. Members never get the Administration control.
- The chooser never requests the Admin Cohort catalogue.
- Server authorization runs before `PresenceSessionGate`. The pending
  destination is workflow state and never authorization.
- A new joined page goes in a route group whose layout renders
  `PresenceSessionGate` and, unless it shows the map, `PresenceDock`.
- Remote audio plays only from `RemoteAudioOutput`; tiles render video only.
- Load `livekit-client` only through `services/livekit/livekit-client.ts`.
- The meeting view shows only whom world's `nearby` names. Never measure
  distance on the client to decide who is near.
- Meeting motion animates opacity and transform strings only
  (`components/meeting-motion.ts`), and transforms settle on `none`: a
  transformed ancestor would re-anchor the fixed expanded grid.
- Use `GLOSSARY.md` terms (Active Campus, Campus Shell, Join Gate, Presence
  Session, Presence Tab, Presence Dock).
- Comment only a non-obvious why.

## Tests

```bash
pnpm vitest run --project=unit features/campus
pnpm vitest run --project=unit \
  tests/evals/meeting-header.eval.test.tsx \
  tests/evals/meeting-view-switch.eval.test.tsx \
  tests/evals/proximity-view.eval.test.tsx \
  tests/evals/campus-control-bar.eval.test.tsx \
  tests/evals/media-controls.eval.test.tsx \
  tests/evals/join-gate.eval.test.tsx \
  tests/evals/presence-session-routes.eval.test.ts \
  tests/evals/presence-tab.eval.test.ts
```

The evals render the real Active Campus and Administration layouts
(`tests/fixtures/active-campus-layout.tsx`,
`tests/fixtures/administration-layout.tsx`) inside an injected Presence
Session (`tests/fixtures/presence-session.tsx`) with auth stubbed.
