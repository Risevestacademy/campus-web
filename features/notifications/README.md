# Notifications

Owns a member's notifications in the campus: the sidebar panel that lists them,
the unread count that badges its rail item, and reading them. A notification is
one campus-api keeps for the account: a notice was posted, or a request to
enter a space was admitted or declined. Posting notices and answering
requests belong elsewhere; this only shows what they leave behind.

## Interface

`index.ts` is the only entry point.

| Export                   | Composed by                                         |
| ------------------------ | --------------------------------------------------- |
| `NotificationsPanel`     | both `app/campus/[id]` layouts, as the shell's prop |
| `useUnreadNotifications` | both `app/campus/[id]` layouts, as the shell's prop |

The campus feature may not import this one, so the routes pass both into
`CampusShell`. The panel receives the cohort's id and the sidebar's collapse
button; the hook takes the cohort's id and returns how many are unread. The
rail shows its Notifications item only when both are passed.

### How it stays current

- **campus-api's list is the record.** `GET /v1/notifications` (newest first,
  20 a page, with "Show older") and `?unread=true` for the count, whose page
  holds one and whose `meta.total` is the count.
- **world only nudges.** A `notification` frame means one was written, and world
  may miss one. `core/presence` counts the frames in `notificationsVersion`,
  and that count is part of both query keys, so each frame reads the list and
  the count again while the old ones stay on screen. Fetching on arriving is the
  mount itself.
- **The toast is the campus feature's.** `notification-feedback.ts` in the world
  session greets each frame and shares its wording with the list through
  `core/notifications`.
- Reading one is pressing it (`PATCH /v1/notifications/{id}/read`); "Mark all as
  read" is `POST /v1/notifications/read-all`. Either way both queries are read
  again afterwards, so a notification another tab read does not stay unread.
- A kind campus-api adds later reads as `"unknown"` and shows as a plain alert.
- Only the id, kind, space, read state and time are kept. A notice's text has no
  route to fetch it yet, so a posted notice reads as "A new notice was posted."

## Modules

| Module                    | Owns                                                                 | Seam                   |
| ------------------------- | -------------------------------------------------------------------- | ---------------------- |
| `schemas/`                | the list page and its notifications, parsed                          | `@/core/api/client`    |
| `services/`               | the four calls: list, count, read one, read all                      | `@/core/api/client`    |
| `hooks/`                  | the list, the count and the two mutations, keyed by world's nudges   | `@/core/presence`      |
| `components/`             | the panel and its rows                                               | `@/core/notifications` |
| `relative-time.ts`        | "3 minutes ago" from an ISO time                                     | none                   |
| `unread-notifications.ts` | the count hook as a client export, so a server layout can pass it on | none                   |

## Contributing

- A new kind: add it to `NotificationKind` (`core/realtime`), word it in
  `core/notifications/describe-notification.ts`, and give it an icon in
  `components/notification-row.tsx`.
- Keep a field out of the schema until something shows it, and update
  `tests/evals/data-privacy.eval.test.ts` when widening what a frame keeps.
- A notice's text arrives with a read route for notices; then a posted notice can
  open it.

## Tests

```bash
pnpm vitest run --project=unit features/notifications core/notifications
```
