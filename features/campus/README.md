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
  LogOutAction={LogOutAction} // draws Log out in the account menu and Settings
  OwnProfileAction={OwnProfileAction} // the member's summary and profile editor, from profile
  administrationPanel={adminSidebar}
  OverviewPanel={CampusOverviewPanel} // gets cohort, cohortId and collapseButton
  cohort={{ name: "Product Design 2026", role: "student" }} // the member's place; undefined for an administrator with none
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
`useMeeting(cohortId)` for you plus presence's `meetingRoster` (your room
mates under room hearing, whoever is near otherwise, in the order they
arrived), titled "Nearby" or with the room's name, and shows nothing while
the roster is empty. A grid remembers the `encounter` it opened for, so the next
encounter starts on the map (`visibleMeetingLayout`). Meeting layout and sidebar-opening
transitions belong to `CampusViewProvider`, whose intent actions preserve the
rule that an expanded meeting and open sidebar cannot coexist.
`useMeetingViewShown` sends `campus.proximity_view_shown` with the
meeting's `hearing` each time the meeting view mounts, keyed by `encounter`
so it reports once per encounter.

The chat panel (`components/chat/`) sits on the right of the Active Campus, opened
from the control bar's chat button (`ChatToggleButton`) and closed by its own
close button, Escape inside it, or the same button. It has three tabs, Chat,
People and Resources (the pill tabs in `shared/ui/tabs`), and a line under them
saying whom a line reaches: everyone in the room, or people nearby. The People tab
lists who is in the meeting, you first (`selectChatPeople`, from the same roster
the meeting view uses), with each person's microphone as the tiles read it.
The Chat tab is the conversation in the member's space (`chat-conversation.tsx`):
a note that messages are not saved, a "You joined" divider timed by presence's
`spaceEnteredAt`, the lines grouped by speaker and minute with the member's own
named "You" (`services/chat/chat-messages.ts`), and a composer that sends on
Enter and adds a line on Shift+Enter. Text is only ever drawn as text. The
composer holds a line back when it cannot go out, keeping the text and saying
why: it mirrors world's send limit (`services/chat/send-budget.ts`, five lines
at once then one a second), and says Reconnecting… while the socket is down.
What is typed and not sent survives closing the panel in
`store/chat-panel-store.ts`, in memory only. Lines from other people arriving
while the Chat tab is not showing count as unread (`hooks/use-chat-unread.ts`)
on the control bar button, capped at 99+, and as a dot on the Chat tab while
the panel is on another tab. Whether it is open
and which tab shows live in `store/chat-panel-store.ts`, never saved: the sidebar
and the chat panel are never open together, so `useSidebarVisible` is the saved
sidebar choice and not chat open. Chat opening or closing never writes the saved
sidebar choice, so the sidebar returns by itself; showing the sidebar (`openSidebar`,
`openPanel`, `openAdministration` on `CampusViewProvider`) closes chat. The store is
reset when the panel leaves the screen, and `ActiveCampus` keys it by cohort, so chat
never follows the member to another page or cohort, where nothing could close it. The
panel is as wide as the sidebar, so swapping them does not move the meeting.

Files in chat: a call's members can send a file with a line. The paperclip
opens the picker only where the space has a call (`presence.spaceId`, read from
the call's room name), and says so in the corridors, which hold none. Before any
work is done, `useSendChatFile` checks a line could go out (the socket is up and
the send budget has one), then uploads with `core/uploads` (`call_chat_attachment`,
with progress and Cancel), ties the upload to the call (`attachToCall`:
`POST /v1/cohorts/{cohortId}/spaces/{spaceId}/call/attachments`), and says the
line through world with the file, whatever is typed riding as its caption (the box
is cleared only if it still holds that caption). The member can walk on while it
uploads, so the space is read again before the file is tied to a call and again
before it is said, and Cancel is honoured until the line is said. Each
refusal has its own words: a wrong type or a size over the limit, too many
uploads, no call going on (409), not allowed in the space, or an upload that did
not arrive whole. A link campus-api answers 404 for is a file removed or a space
the member may no longer enter, and is said as that. A file arrives on a line as a card (`chat-file-card.tsx`): its
icon (from a small allow-list of content types, else a plain file), name and size
and an Open button. Opening asks campus-api for a fresh link, which lasts fifteen
minutes and is never kept (`GET /v1/media/{id}/url`, `useOpenChatFile`), in a tab
opened during the click so a browser does not take the wait as a popup. A file
that answers 410 is let go: the call ended, and the card says "This file is no
longer available" (remembered for the session in `store/chat-panel-store.ts`). The
Resources tab lists the files seen in the space, newest first, with who sent
each and when, counted on its tab; there is no list route, so it is what this
device has seen since the member came into the space, and it clears with the
chat.

The rail's avatar opens the member's account menu (`rail-account.tsx`): their
name, track and cohort, and status; the status choices (the tray's `menu`
variant); Edit profile and Change character, which open profile's editor on
that tab; and their email with Log out, which asks before ending the session.
Without `OwnProfileAction` the menu names the member from the session and has
no profile items; without `LogOutAction` it has no Log out.

Routes pass Auth-, Admin-, Feedback-, Profile- and Roster-owned UI in as props,
because Campus may not import those features.

## Modules

| Module                                                                                                                                                           | Owns                                                                                                                                                                                                       | Seam                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `components/cohort-chooser.tsx`, `cohort-card.tsx`, `types/`                                                                                                     | member Cohort selection from session memberships                                                                                                                                                           | none                                          |
| `components/campus-shell/`                                                                                                                                       | rail (with Privacy choices, Settings and the account menu), sidebar, panel switching, collapse, and the layer that places the Feedback popup                                                               | `core/analytics/consent`                      |
| `store/`, `hooks/use-sidebar-state.ts`                                                                                                                           | sidebar open, panel, and mode, persisted in `localStorage`                                                                                                                                                 | `localStorage`                                |
| `schemas/sidebar-preferences.schema.ts`                                                                                                                          | parsing stored sidebar preferences; each bad field falls back alone                                                                                                                                        | `parseJson`                                   |
| `store/feedback-panel-store.ts`                                                                                                                                  | whether the Feedback popup is open (not persisted)                                                                                                                                                         | none                                          |
| `components/settings/`                                                                                                                                           | the rail's Settings dialog: devices, theme (Light, Dark, Match device), Reduce motion (`shared/motion`), usage analytics, Log out; Notifications is a placeholder tab                                      | `useMediaSession`, `LogOutAction`             |
| `components/` (media UI)                                                                                                                                         | `ActiveCampus`, control bar, media toggles and settings, meeting header, tiles, view switch                                                                                                                | `useMediaSession`, `CampusViewProvider`       |
| `services/presence-session/`, `components/presence-session*`, `components/*presence-tab*`                                                                        | per-cohort admission, Presence Tab, session composition, gate ([README](services/presence-session/README.md))                                                                                              | `useAdmission`, `usePresenceTab`              |
| `components/chat/`, `store/chat-panel-store.ts`, `hooks/use-chat-*.ts`, `hooks/use-send-chat.ts`, `services/chat/`                                               | the chat panel: tabs, the conversation, the People tab, and the swap with the sidebar; open, tab, and per cohort the draft, read marker and send budget, never saved                                       | `presenceFor`, `socialFor`, `useMediaSession` |
| `components/meeting-header.tsx`, `hooks/use-space-lock.ts`                                                                                                       | the header over the map: the meeting's people, the lock for a lockable space you stand in (alone too), and Open sidebar while the sidebar is closed                                                        | `socialFor`, `presenceFor`                    |
| `components/status-dock.tsx`, `status-tray.tsx`, `presence-menu-trigger.tsx`, `services/status-choice/`, `hooks/use-own-status.ts`, `hooks/use-status-choice.ts` | the member's avatar on both docks and the tray it opens, also drawn in the account menu: Available, Busy or Away, optionally for a fixed time; sends `setStatus` and draws it at once                      | `socialFor`, `presenceFor`                    |
| `components/presence-dock.tsx`, `remote-audio-output.tsx`, `hooks/use-call-audio-feedback.ts`, `hooks/use-camera-publish-feedback.ts`                            | compact controls on non-map pages; one audio mix, one call-audio failure toast and one refused-camera toast per session                                                                                    | `useMediaSession`                             |
| `components/broadcast-control.tsx`, `hooks/use-broadcast-speaking-feedback.ts`                                                                                   | an admin's Speak to everyone in the control bar and Presence Dock, and one refused-broadcast toast per session                                                                                             | `useMediaSession`, `presenceFor`              |
| `components/broadcast-status.tsx`, `hooks/use-remote-audio-volume.ts`                                                                                            | who is speaking in the cohort's broadcast, and the space call's ducked volume under it                                                                                                                     | `useMediaSession`, `presenceFor`              |
| `components/screen-share-*.tsx`, `hooks/use-screen-capture-supported.ts`, `hooks/use-screen-share-feedback.ts`                                                   | Share screen in the control bar during a meeting with a call, Stop on the bar and Presence Dock, one screen-share toast per session                                                                        | `useMediaSession`, `useMeeting`               |
| `services/meeting/`, `hooks/use-meeting.ts`, `components/meeting-overlay.tsx`                                                                                    | the meeting view's people and title from presence `meetingRoster`: order, names, initials, tones, caps, and which layout shows                                                                             | `useMeeting`                                  |
| `hooks/use-video-demand-ref.ts`, `components/meeting-tiles.tsx`                                                                                                  | remote tiles on screen ask for their participant's camera or screen at the layer their size needs                                                                                                          | `useVideoDemandRef`                           |
| `services/media-session/`                                                                                                                                        | capture, devices, publications ([README](services/media-session/README.md))                                                                                                                                | `MeetingMediaTransport`                       |
| `services/call-media/`                                                                                                                                           | joining World's call room over LiveKit, meeting-roster audio, on-screen cameras and screens, roster-only grants, full gain in a room and distance gain otherwise ([README](services/call-media/README.md)) | `MeetingRoomTransport`                        |
| `services/microphone-level/`, `hooks/use-microphone-level-ref.ts`                                                                                                | the member's own microphone level, filling the mic glyph ([README](services/microphone-level/README.md))                                                                                                   | `useMicrophoneLevelRef`                       |
| `services/livekit/`                                                                                                                                              | the one dynamic `livekit-client` import, shared by the connection check and call media                                                                                                                     | `loadLivekitClient`                           |
| `services/world-session/`, `components/world-connection-status.tsx`                                                                                              | the cohort's world socket feeding the map; its quiet status and Reconnect ([README](services/world-session/README.md))                                                                                     | `useWorldSession`                             |
| `services/connection-check/`, `schemas/connection-check.schema.ts`, `hooks/use-connection-check.ts`, `components/connection-check*`                              | the Join Gate's pre-join connection check: world's token, the media host pin, the LiveKit run ([README](services/connection-check/README.md))                                                              | `useConnectionCheck`                          |
| `testing/`                                                                                                                                                       | media session, Presence Tab, world session and LiveKit test utilities                                                                                                                                      | none                                          |

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
  sidebar writes with meeting layout. Draw the sidebar from `useSidebarVisible`,
  which gives way to the chat panel; `useSidebarOpen` is the saved choice.
- The chat draft, read marker and send budget are held by cohort, outside React:
  the composer leaving the screen must not hand back a full budget, and one
  cohort's words never show in another.
- Chat panel state is read through `hooks/use-chat-panel.ts`. Never write the
  saved sidebar choice to make room for chat, and never save chat state.
- Do not add a meeting lock control until a real meeting capability owns it.
- Cohort Administration opens in Administration mode; Active Campus restores
  the stored mode. Members never get the Administration control.
- The chooser never requests the Admin Cohort catalogue.
- Server authorization runs before `PresenceSessionGate`. The pending
  destination is workflow state and never authorization.
- A new joined page goes in a route group whose layout renders
  `PresenceSessionGate` and, unless it shows the map, `PresenceDock`.
- Remote audio plays only from `RemoteAudioOutput`; tiles render video only.
  A broadcast plays there at full volume with no way to mute it, the space's
  call drops to `BROADCAST_DUCKED_GAIN` underneath, and a broadcasting admin
  is heard from the broadcast alone. `BroadcastStatus` says who is speaking,
  over the control bar and on the Presence Dock.
  A person's tile names them, shows whether their microphone is on, and glows
  while the level meter hears them speak. It meters the microphone's track and
  never plays it.
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
