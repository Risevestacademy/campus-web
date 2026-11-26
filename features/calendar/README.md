# Calendar

Owns a member's Google Calendar inside Campus: connecting and disconnecting
it, the Calendar panel in the sidebar, and the calendar page. Campus only
reads. It never creates, edits or cancels a Google event, and it sends no
reminders. Making a room link for an event belongs to campus-api's room-link
routes; the page that opens one (`/join/{code}`) belongs to `room-link`.

## Interface

`index.ts` is the only entry point.

| Export                       | Composed by                                                |
| ---------------------------- | ---------------------------------------------------------- |
| `CalendarPanel`              | the three `app/campus/[id]` layouts, through `CampusShell` |
| `CalendarPage`               | `app/campus/[id]/(calendar)/calendar/page.tsx`             |
| `CalendarOutcomeNotice`      | `app/campus/page.tsx` and the calendar page                |
| `parseConnectOutcome`        | the same two pages, to read `?calendar=`                   |
| `CALENDAR_OUTCOME_PARAMETER` | the same two pages                                         |
| `ConnectOutcome`             | the same two pages (type)                                  |

### The page

The calendar sits in the campus shell like the administration pages do: its
panel in the sidebar and the calendar in the main area, with no map or meeting
behind it. The rail's Calendar item is a link to
`/campus/{cohortId}/calendar` (`calendarHref` in `core/navigation`), and the
page tells the shell it is the Calendar panel (`initialPanel`), so landing on
it shows the panel whatever the member had open.

### Connecting

Connecting leaves the app. The connect button is a plain link to
`/api/v1/calendar/connect`, which campus-api answers with a redirect to
Google. Google sends the member back to campus-api's callback, which needs the
session that started it, and campus-api finishes with a redirect to
`{APP_PUBLIC_URL}/campus?calendar=<outcome>`. The proxy only passes the
redirects and the session cookie through.

- **The session is renewed first.** The link renews it, then goes. If it
  could not renew, it goes anyway: the callback answers `unauthorized`, which
  the member is told. A new-tab click is left to the browser.
- **`/campus?calendar=`** is read by `app/campus/page.tsx`. A member with one
  cohort is sent on to that cohort's calendar page with the outcome, so they
  land where they started. A member with several, or an administrator, stays
  on the chooser and is told there. A value that is not one of campus-api's
  outcomes is ignored, so the address bar cannot put words on screen.
- **`CalendarOutcomeNotice`** shows the outcome once, then takes the
  parameter off the address.

### What is read of the events answer

Only `connected`. The events route is read for this week to learn whether the
member has a calendar connected, and everything else in the answer is dropped
where it is parsed. The next step reads the events themselves, and an event
that carries no room the member may open is kept only as a time.

### Decisions

- **No sync time.** campus-api reads Google on each request and keeps no sync
  time, so the panel says "Connected to Google · loaded 14:20", the time this
  device last loaded.
- **A failed read is not kept.** The next look asks again, so a Google that
  was slow comes back without a reload.
- **Disconnecting asks once.** The gear opens a short note on what it does,
  and its button is the confirmation.

## Modules

| Module        | Owns                                                             | Seam                |
| ------------- | ---------------------------------------------------------------- | ------------------- |
| `schemas/`    | the outcomes of connecting, and the status fields the page reads | `@/core/api/client` |
| `services/`   | the events and disconnect calls, the week window, outcome words  | `@/core/api/client` |
| `hooks/`      | the status query, disconnecting, and the connect link's renewal  | `@/core/session`    |
| `components/` | the panel, the page, the connect card, the gear and the notice   | none                |

## Contributing

Keep a field out of `calendarStatusSchema` until something renders or
computes with it, and update `tests/evals/data-privacy.eval.test.ts` when you
widen it. The title, location, description and links of an event belong to the
member: never keep them for an event with no room, never log them, never send
them to analytics or storage.

A new outcome of connecting goes in `connect-outcome.schema.ts` and
`connect-outcome-notice.ts`; campus-api's list is `CALENDAR_CONNECT_OUTCOMES`.

## Tests

```bash
pnpm vitest run --project=unit features/calendar
```
