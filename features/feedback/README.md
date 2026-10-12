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
(the Campus Shell's content area), and the member's `userName` for the
confirmation greeting. The route passes it in because Campus may not import
Feedback.

## Modules

| Module                                                | Owns                                                      | Seam                   |
| ----------------------------------------------------- | --------------------------------------------------------- | ---------------------- |
| `feedback-popup.tsx`                                  | the modal, history state, form and confirmation switching | none                   |
| `feedback-form.tsx`, `screenshot-field.tsx`           | the form, its validation display, the screenshot picker   | none                   |
| `feedback-list.tsx`, `feedback-detail.tsx`            | the feedback history and the selected item's details      | none                   |
| `feedback-sent.tsx`                                   | the confirmation screen                                   | none                   |
| `feedback.schema.ts`, `feedback-kinds.ts`, `types.ts` | validation, kind labels and icons, types                  | none                   |
| `mock-feedback.ts`                                    | seeded history until campus-api exists                    | replaced by an adapter |

campus-api has no feedback endpoints yet. Sending adds the item to in-memory
state, so the list resets on reload, and the screenshot never leaves the
browser.

## Contributing

### Adding a kind of feedback

1. Add it to `FeedbackKind` in `types.ts`.
2. Add its entry to `feedbackKinds` in `feedback-kinds.ts`.

### Replacing the mock

Read the history in a Server Component and pass it to the popup, and send
through a mutation hook with `browserApi`, following "Adding a mutation" in
`features/admin/README.md`. Delete `mock-feedback.ts` and the in-memory
`send`.

### Rules

- Import no other feature.
- Validate in `feedback.schema.ts`, never in a component.
- Comment only a non-obvious why.

## Tests

```bash
pnpm vitest run --project=unit features/feedback
```
