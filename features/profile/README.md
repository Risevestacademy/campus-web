# Profile

Owns the member's own profile (reading it, the editor that changes it, and the
one-line summary the Campus Shell's account menu shows) and the card that shows
another member's profile.

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

```tsx
import { MemberProfileCard } from "@/features/profile";

<CampusOverviewPanel ProfileCard={MemberProfileCard} … />;
```

`MemberProfileCard` draws another member's card inside a `Popover`, whose title
is their name. It takes their `userId` and the `cohortId`, the `name`,
`initial` and `avatarClassName` the caller already shows (drawn until the card
is read), their `presence` (`badgeClassName` and a `label` such as
`Busy · 4 min`, since the caller owns presence) and optional `actions`. It
reads `GET /v1/users/{id}/profile` and shows their photo, name, "Role · Track"
in the cohort and bio. A 404 says the profile isn't available. The desk row is
placeholder data until desks are read, and its View desk does nothing yet.
`app/campus/[id]/campus-overview-panel.tsx` joins it to the roster.

## Modules

| Module                                                                                                               | Owns                                                                                    | Seam                                                     |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `components/own-profile-action.tsx`                                                                                  | the summary and the editor's open state for a control another feature draws             | `useOwnProfile`                                          |
| `components/profile-dialog.tsx`, `profile-form.tsx`, `character-panel.tsx`                                           | the editor: its Profile and Character tabs, the form, and Character's empty placeholder | `useSaveOwnProfile`                                      |
| `schemas/own-profile.schema.ts`, `types.ts`                                                                          | parsing the profile, reading the form into changed fields, and the summary              | none                                                     |
| `services/`, `hooks/`                                                                                                | `GET` and `PATCH /v1/users/me`, the cached profile, and the save's pending and problems | `services/own-profile-api.adapter.ts`                    |
| `components/avatar-editor.tsx`, `lib/crop-avatar.ts`, `hooks/use-change-avatar.ts`, `services/avatar-api.adapter.ts` | the picture: cropper, export, upload, set and remove                                    | `@/core/uploads`, `PUT` and `DELETE /v1/users/me/avatar` |
| `components/member-profile-card.tsx`                                                                                 | another member's card                                                                   | `useMemberProfile`                                       |
| `schemas/member-profile.schema.ts`, `services/member-profile-api.adapter.ts`                                         | parsing and reading `GET /v1/users/{id}/profile`, the card's name and role line         | `@/core/api/client`                                      |

The editor changes first and last name, display name, bio and phone, and
sends only the fields that changed; an emptied field is sent as null, which
clears it. The phone is checked as campus-api checks it (digits, an optional
leading +, and spaces, hyphens or brackets between them), so a bad one is
shown beside the field before anything is sent. Cohort, track and role are
shown read-only: admins set them. A saved profile replaces the cached one and
refreshes the route, because the rail and dock draw the member from the
session the route layout reads. A 401 on save goes to sign-in.

The Profile tab's picture (`avatar-editor.tsx`) uploads a new one or removes
it. A picked file opens a square cropper; the crop is drawn onto a 512×512
canvas and exported as WebP, or JPEG where the browser cannot encode WebP
(`lib/crop-avatar.ts`), which also drops the photo's EXIF and GPS. It goes up
through `uploadMedia` from `@/core/uploads` with a progress bar and Cancel
upload, then `PUT /v1/users/me/avatar` sets it. Remove picture asks first,
since campus-api also drops a Google picture for good, then calls
`DELETE /v1/users/me/avatar`. Either answer replaces the cached profile and
refreshes the route, so avatars drawn from the session follow.

Every avatar draws the picture when there is one and the initial otherwise.
The initial also shows while the picture loads and when it fails, as an old
picture's address does minutes after a change: `AvatarImage` only appears
once its image has loaded. The Character tab is
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
- Validate in `schemas/`, never in a component. Form
  submits go through `parseForm` from `@/shared/lib/forms`.
- Comment only a non-obvious why.

## Tests

```bash
pnpm vitest run --project=unit features/profile
pnpm eval:privacy
```

The component test renders `OwnProfileAction` against a mock campus-api: the
summary, the filled editor, saving only what changed, an unchanged form, a bad
phone, a refused save, the Character tab and an unreadable profile. The picture's test
stubs the cropper and the canvas export, which jsdom cannot draw, and covers
a set picture, a refused upload, Cancel upload, asking before removing, and a
file that is not a picture. The card's test
renders `MemberProfileCard` in an open popover: a read card, the caller's name
while it loads, a missing card and an unreadable one.
