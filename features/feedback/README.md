# Feedback

Owns the Feedback popup a member opens from the Campus Shell's "Report an
issue" rail button: the form, the member's feedback history with each item's details, and the
confirmation after sending. Opening and placing the popup belongs to `campus`.

## Interface

```tsx
import { FeedbackPopup } from "@/features/feedback";

<CampusShell FeedbackPopup={FeedbackPopup} userName={user.displayName} … />;
```

`FeedbackPopup` receives `isOpen`, `onClose`, a `container` ref to portal into
(the Campus Shell's content area), the cohort's id, the member's `userId` (so
the picker leaves them out) and `userName` for the confirmation greeting. The route passes it in because Campus may not import
Feedback.

## Modules

| Module                                                        | Owns                                                           | Seam                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------- |
| `feedback-popup.tsx`                                          | the modal, history state, form and confirmation switching      | none                                    |
| `feedback-form.tsx`, `screenshot-field.tsx`                   | the form, its validation display, the screenshot picker        | none                                    |
| `feedback-list.tsx`, `feedback-detail.tsx`                    | the feedback history and the selected item's details           | none                                    |
| `feedback-sent.tsx`                                           | the confirmation screen                                        | none                                    |
| `schemas/feedback.schema.ts`, `feedback-kinds.ts`, `types.ts` | validation, kind labels and icons, types                       | none                                    |
| `report-person-field.tsx`, `schemas/people.schema.ts`         | the report's person picker, and its unavailable notice         | `services/cohort-people-api.adapter.ts` |
| `services/`, `hooks/`                                         | sending to `POST /v1/feedback` and its pending and error state | `services/feedback-api.adapter.ts`      |

Sending calls `POST /v1/feedback` through the browser proxy. A report asks who
is being reported: the member picks a person from
`GET /v1/cohorts/{id}/profiles` (read once a report is chosen, without the
sender) and the report sends their `reportedUserId`. `about` holds only the
place. Two people who share a name are marked, because the list carries
nothing else to tell them apart. When the cohort can't be listed, or lists
nobody else, the form says so and the report goes without a person, with who
it is about left to the details, so a failed lookup never blocks one. Members cannot
read feedback back, so the history lists only what this session sent and
resets on reload. Admins read it in `admin`. Screenshots are not sent: the
backend has nowhere to store them yet, so the picker only previews.

## Contributing

### Adding a kind of feedback

1. Add it to `feedbackKindSchema` in `schemas/feedback.schema.ts`;
   `FeedbackKind` follows.
2. Add its entry to `KIND_DETAILS` in `feedback-kinds.ts`; typecheck fails
   until you do.

### Rules

- Import no other feature.
- Validate in `schemas/feedback.schema.ts`, never in a component. Form
  submits go through `parseForm` from `@/shared/lib/forms`.
- Comment only a non-obvious why.

## Tests

```bash
pnpm vitest run --project=unit features/feedback
pnpm eval:feedback
```

`eval:feedback` renders the real popup against a mock campus-api and holds
every case: a refused submit sends nothing, an accepted one sends exactly one
request, screenshots are chosen, refused and previewed as designed, and the
screenshot never leaves the browser.
