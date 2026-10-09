# Campus

Owns the member-facing Cohort chooser, the Campus Shell (rail and sidebar),
and the Active Campus media UI inside it. Admin catalogues and pages belong to
`admin`, access decisions to `auth`, and the participant list to `roster`.

## Interface

| Entry         | Imported by           | Exports                                                                                                                    |
| ------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`    | routes                | `CohortChooser`, `CampusShell`, `ActiveCampus`, `CampusMediaSessionProvider`, `VisualsDisplay`, `SidebarCollapseButton`, … |
| `document.ts` | `app/layout.tsx` only | `sidebarInitializerScript` (sizes the sidebar before hydration)                                                            |

```tsx
<CampusShell
  AccountMenu={AccountMenu}
  administrationPanel={adminSidebar}
  OverviewPanel={CampusOverviewPanel}
  cohortId={id}
  initialSidebarMode="admin" // Cohort Administration only
>
  <CampusMediaSessionProvider>
    <ActiveCampus>{children}</ActiveCampus>
  </CampusMediaSessionProvider>
</CampusShell>
```

Routes pass Auth-, Admin-, and Roster-owned UI in as props, because Campus may
not import those features.

## Modules

| Module                                                       | Owns                                                                                        | Seam                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------- |
| `components/cohort-chooser.tsx`, `cohort-card.tsx`, `types/` | member Cohort selection from session memberships                                            | none                    |
| `components/campus-shell/`                                   | rail, sidebar, panel switching, collapse                                                    | none                    |
| `store/`, `hooks/use-sidebar-state.ts`                       | sidebar open, panel, and mode, persisted in `localStorage`                                  | `localStorage`          |
| `components/` (media UI)                                     | `ActiveCampus`, control bar, media toggles and settings, meeting header, tiles, view switch | `useMediaSession`       |
| `services/media-session/`                                    | capture, devices, publications ([README](services/media-session/README.md))                 | `MeetingMediaTransport` |
| `testing/`                                                   | media session test utilities                                                                | none                    |

Flow: component → `useMediaSession(selector)` or sidebar hooks → store →
browser media or `localStorage`.

## Contributing

### Adding a rail panel

1. Add the id to `SidebarPanelId` and `SIDEBAR_PANEL_IDS` in
   `store/sidebar-preferences.ts`.
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
  through `store/sidebar-store.ts`.
- Cohort Administration opens in Administration mode; Active Campus restores
  the stored mode. Members never get the Administration control.
- The chooser never requests the Admin Cohort catalogue.
- Use `GLOSSARY.md` terms (Active Campus, Campus Shell, Join Gate).
- Comment only a non-obvious why.

## Tests

```bash
pnpm vitest run --project=unit features/campus
pnpm vitest run --project=unit \
  tests/evals/meeting-header.eval.test.tsx \
  tests/evals/meeting-view-switch.eval.test.tsx \
  tests/evals/campus-control-bar.eval.test.tsx \
  tests/evals/media-controls.eval.test.tsx
```

The evals render the real Active Campus layout
(`tests/fixtures/active-campus-layout.tsx`) with auth stubbed.
