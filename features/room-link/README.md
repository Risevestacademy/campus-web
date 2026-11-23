# Room link

Owns what happens at `/join/{code}`: a short link to one space in one cohort's
campus, made by staff for an event (`{APP_PUBLIC_URL}/join/{code}`). Entering
it asks campus-api for the link's cohort and space, then sends the member
through that cohort's pre-join to the map, where they are walked to the space.
Making, listing and revoking links belongs to campus-api and staff tools, not
here.

## Interface

`index.ts` is the only entry point.

| Export              | Composed by                |
| ------------------- | -------------------------- |
| `parseRoomLinkCode` | `app/join/[code]/page.tsx` |
| `enterRoomLink`     | `app/join/[code]/page.tsx` |
| `RoomLinkNotice`    | `app/join/[code]/page.tsx` |

The route does the rest. It asks auth for access (`kind: "room-link"`: any
full-access session may arrive), enters on the server, and redirects through
`campusPreJoinHref(cohortId, "/campus/{cohortId}?goToSpace={spaceKey}")`. The
map's page reads `goToSpace` and walks the member there once world is ready
(`WalkOnArrival` in `campus-world`).

### Decisions

- **The code is a pointer, not a key.** Entering checks the caller's place in
  the link's cohort. Revoked, never set up, malformed, or not the caller's all
  look the same, so a code tells somebody it is not for nothing.
- **Entering is a POST with an effect.** While the event window is open it
  gives the caller a pass into the space. It is repeatable, and runs on the
  server when somebody opens the page, never from a link prefetch.
- **Only the cohort and the space are kept.** The title, window and `admitted`
  are for campus-api and world. A door still closed when the walk gets there
  ends it with the refusal notice ("Room 1 is private").
- **The target travels in the URL.** Pre-join starts a new session and a
  reload forgets anything in memory.

## Modules

| Module        | Owns                                                 | Seam                |
| ------------- | ---------------------------------------------------- | ------------------- |
| `schemas/`    | the code's shape and the entry fields the page reads | `@/core/api/client` |
| `services/`   | `POST /v1/room-links/{code}/enter` and its outcomes  | `@/core/api/client` |
| `components/` | the notice for a link that does not work or is down  | none                |

## Contributing

Keep a field out of `roomLinkEntrySchema` until something renders or computes
with it, and update `tests/evals/data-privacy.eval.test.ts` when you widen it.
A new outcome of entering goes in `RoomLinkEntryRead` and the page's switch.

## Tests

```bash
pnpm vitest run --project=unit features/room-link
```
