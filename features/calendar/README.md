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

### The calendar

The main area shows the days the member picked: Day, Week (Monday first) or
Month (six weeks), in their own time zone. Times are read as the zone Google
gave and drawn on the wall clock, so a day the clocks change keeps its hours.
An event across midnight is drawn on each day, cut at midnight, and an
all-day event is a pair of dates read as days, never as timestamps. Events
that overlap share the column.

- **One read per range.** `readCalendarEvents` asks campus-api for the range on
  screen (never more than the 62 days it reads), and TanStack Query keeps each
  range for a minute. The days before stay on screen while the next load.
- **What the panel and the page share** lives in `store/calendar-view-store`:
  the view, the day it is built around and the two filters. Nothing of it is
  saved. `hooks/use-calendar-model` joins it to the read for both.
- **LIVE and Join.** An event with a room is live from ten minutes before it
  starts until it ends, and shows LIVE in words (not colour alone) with a Join
  link to `/join/{code}`. The clock is a hook (`use-now`, every 30 seconds) and
  every rule takes `now`, so tests do not depend on the time.
- **Details** open in a popover: the room, the member's own answer, Copy room
  link, Go to room, and Open in Google Calendar.
- **States.** Not answering (dims what was shown, with Retry), connection ended
  (told once, then the connect card), more than 1,000 events, and nothing in
  the range.

### What is kept of an event

Only an event whose room belongs to the cohort being viewed keeps its words:
title, place, a Google link and the room's code and name. Every other event,
whether it has no room or a room in another cohort, is reduced to its times
and answer when the answer is parsed, and shows as Busy. The meeting link is
never kept. The Google link is kept only if it is `https` on a Google host,
and is opened with `rel="noopener noreferrer"`. A single event campus cannot
read is skipped, not the whole answer.

### Decisions

- **No sync time.** campus-api reads Google on each request and keeps no sync
  time, so the panel says "Connected to Google · loaded 14:20", the time this
  device last loaded.
- **A failed read is not kept.** The next look asks again, so a Google that
  was slow comes back without a reload.
- **Disconnecting asks once.** The gear opens a short note on what it does,
  and its button is the confirmation.

## Modules

| Module        | Owns                                                               | Seam                |
| ------------- | ------------------------------------------------------------------ | ------------------- |
| `schemas/`    | the outcomes of connecting and the events, parsed from campus-api  | `@/core/api/client` |
| `services/`   | the events and disconnect calls, ranges, placement, labels, words  | `@/core/api/client` |
| `store/`      | the view, the day shown and the filters, shared by panel and page  | none                |
| `hooks/`      | the events query, the model, the clock, disconnecting, connecting  | `@/core/session`    |
| `components/` | the panel, the page, the grids, event blocks and details, the gear | none                |

## Contributing

Keep a field out of `calendar-events.schema.ts` until something renders or
computes with it, and update `tests/evals/data-privacy.eval.test.ts` when you
widen it. Add a field to a Busy event only if it is a time. The title, location, description and links of an event belong to the
member: never keep them for an event with no room, never log them, never send
them to analytics or storage.

A new outcome of connecting goes in `connect-outcome.schema.ts` and
`connect-outcome-notice.ts`; campus-api's list is `CALENDAR_CONNECT_OUTCOMES`.

## Tests

```bash
pnpm vitest run --project=unit features/calendar
```
