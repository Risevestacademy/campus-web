# Campus

Owns the member-facing Cohort chooser, the Campus Shell (rail and sidebar),
and the Active Campus media UI inside it. Admin catalogues and pages belong to
`admin`, access decisions to `auth`, and the participant list to `roster`.

## Interface

| Entry         | Imported by           | Exports                                                                                                                                             |
| ------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`    | routes                | `CohortChooser`, `CampusShell`, `ActiveCampus`, `PresenceSession`, `PresenceSessionGate`, `PreJoinPresenceTab`, `PresenceDock`, `VisualsDisplay`, … |
| `document.ts` | `app/layout.tsx` only | `sidebarInitializerScript` (sizes the sidebar before hydration)                                                                                     |

```tsx
<CampusShell
  AccountMenu={AccountMenu}
  administrationPanel={adminSidebar}
  OverviewPanel={CampusOverviewPanel}
  cohortId={id}
  initialSidebarMode="admin" // Cohort Administration only
>
  <ActiveCampus viewModel={activeCampusViewModel}>{children}</ActiveCampus>
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

The active-campus route supplies `ActiveCampusViewModel`. Its current value is
an explicit placeholder until meeting and Presence reads exist; leaf media UI
must not create substitute domain state. Meeting layout and sidebar-opening
transitions belong to `CampusViewProvider`, whose intent actions preserve the
rule that an expanded meeting and open sidebar cannot coexist.

Routes pass Auth-, Admin-, Feedback-, and Roster-owned UI in as props, because Campus may
not import those features.

## Modules

| Module                                                                                    | Owns                                                                                                          | Seam                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `components/cohort-chooser.tsx`, `cohort-card.tsx`, `types/`                              | member Cohort selection from session memberships                                                              | none                                    |
| `components/campus-shell/`                                                                | rail, sidebar, panel switching, collapse, and the layer that places the Feedback popup                        | none                                    |
| `store/`, `hooks/use-sidebar-state.ts`                                                    | sidebar open, panel, and mode, persisted in `localStorage`                                                    | `localStorage`                          |
| `schemas/sidebar-preferences.schema.ts`                                                   | parsing stored sidebar preferences; each bad field falls back alone                                           | `parseJson`                             |
| `store/feedback-panel-store.ts`                                                           | whether the Feedback popup is open (not persisted)                                                            | none                                    |
| `components/` (media UI)                                                                  | `ActiveCampus`, control bar, media toggles and settings, meeting header, tiles, view switch                   | `useMediaSession`, `CampusViewProvider` |
| `services/presence-session/`, `components/presence-session*`, `components/*presence-tab*` | per-cohort admission, Presence Tab, session composition, gate ([README](services/presence-session/README.md)) | `useAdmission`, `usePresenceTab`        |
| `components/presence-dock.tsx`, `remote-audio-output.tsx`                                 | compact controls on non-map pages; one audio mix per session                                                  | `useMediaSession`                       |
| `services/media-session/`                                                                 | capture, devices, publications ([README](services/media-session/README.md))                                   | `MeetingMediaTransport`                 |
| `testing/`                                                                                | media session and Presence Tab test utilities                                                                 | none                                    |

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
- Use `GLOSSARY.md` terms (Active Campus, Campus Shell, Join Gate, Presence
  Session, Presence Tab, Presence Dock).
- Comment only a non-obvious why.

## Tests

```bash
pnpm vitest run --project=unit features/campus
pnpm vitest run --project=unit \
  tests/evals/meeting-header.eval.test.tsx \
  tests/evals/meeting-view-switch.eval.test.tsx \
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
