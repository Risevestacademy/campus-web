# Profile

Owns the member's own profile: reading it, the editor that changes it, and the
one-line summary the Campus Shell's account menu shows. Other members'
profile cards are not built yet.

## Interface

```tsx
import { OwnProfileAction } from "@/features/profile";

<CampusShell OwnProfileAction={OwnProfileAction} cohortId={id} … />;
```

`OwnProfileAction` takes the `cohortId` and a render function. It hands that
function the member's `summary` (`displayName`, `email`, and `place`, which is
"Track · Cohort" for the cohort, the cohort alone for a role without a track,
and null for an administrator with no place in it) and `openEditor(section)`,
where `section` is `"profile"` or `"character"`. The summary is undefined until
`GET /v1/users/me` answers, and when it cannot be read. The editor is mounted
beside what the function draws, so closing a menu leaves the editor open. The
route passes it in because Campus may not import Profile.

## Modules

| Module                                                                     | Owns                                                                                    | Seam                                  |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------- |
| `components/own-profile-action.tsx`                                        | the summary and the editor's open state for a control another feature draws             | `useOwnProfile`                       |
| `components/profile-dialog.tsx`, `profile-form.tsx`, `character-panel.tsx` | the editor: its Profile and Character tabs, the form, and Character's empty placeholder | `useSaveOwnProfile`                   |
| `schemas/own-profile.schema.ts`, `types.ts`                                | parsing the profile, reading the form into changed fields, and the summary              | none                                  |
| `services/`, `hooks/`                                                      | `GET` and `PATCH /v1/users/me`, the cached profile, and the save's pending and problems | `services/own-profile-api.adapter.ts` |

The editor changes first and last name, display name, bio and phone, and
sends only the fields that changed; an emptied field is sent as null, which
clears it. The phone is checked as campus-api checks it (digits, an optional
leading +, and spaces, hyphens or brackets between them), so a bad one is
shown beside the field before anything is sent. Cohort, track and role are
shown read-only: admins set them. A saved profile replaces the cached one and
refreshes the route, because the rail and dock draw the member from the
session the route layout reads. A 401 on save goes to sign-in.

The photo is not shown: Google's picture would need its host pinned first, so
the avatar keeps the member's initial as everywhere else. The Character tab is
an empty placeholder until the sprites exist; `spriteKey` is not read or sent.
Projects are not built.

## Contributing

### Adding an editable field

1. Pick it in `OwnProfile` and `ProfilePatch` in `types.ts`, and parse it in
   `ownProfileSchema`; update `OWN_PROFILE_ALLOW_LIST` in
   `tests/evals/data-privacy.eval.test.ts` in the same change.
2. Add it to `ProfileFieldValues` and `profileFieldsSchema`, and draw it in
   `profile-form.tsx`.

### Rules

- Import no other feature.
- Validate in `schemas/own-profile.schema.ts`, never in a component. Form
  submits go through `parseForm` from `@/shared/lib/forms`.
- Comment only a non-obvious why.

## Tests

```bash
pnpm vitest run --project=unit features/profile
pnpm eval:privacy
```

The component test renders `OwnProfileAction` against a mock campus-api: the
summary, the filled editor, saving only what changed, an unchanged form, a bad
phone, a refused save, the Character tab and an unreadable profile.
