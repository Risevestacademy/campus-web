# Invitation

Owns what an invitee sees and does between opening the emailed Invite Link
and entering Campus: the public Invite Preview, the signed-in confirmation,
and the accept. `auth` decides who may reach each route; this feature decides
what renders there. Invitation administration will belong to `admin`.

## Interface

```tsx
import {
  INVITE_TOKEN_COOKIE_SCOPE,
  InvitationOffer,
  InviteConfirmation,
  readInviteToken,
} from "@/features/invitation";

// /invitation, after the proxy moved ?token=… into a cookie (no session; the
// token is the proof)
const token = await readInviteToken();
<InvitationOffer api={await getServerApi()} token={token} />;

// /preview, inside InvitationGate
<InviteConfirmation api={await getServerApi()} />;
```

The root `proxy.ts` imports `moveInviteTokenToCookie` from `proxy.ts` (no
React, no `server-only`). It answers `/invitation?token=…` with a 303 to the
clean `/invitation` and an HttpOnly `campus_invite_token` cookie scoped to
`/invitation` for 30 minutes, so the page, PostHog, browser history and
`Referer` never see the token.

`app/api/[...path]/route.ts` passes `INVITE_TOKEN_COOKIE_SCOPE` to the API
proxy as a cookie spent by sign-in. Once the Google callback starts a session,
the proxy expires the token, and campus-api's redirect back to `/invitation`
renders `ResumeInvitation`, which sends the session on to `/preview`.

Both components are async Server Components that take the route's server `ApiClient`.
Pass the default `getServerApi()`, not `authentication: "none"`: only it
forwards the visitor's address, which campus-api rate-limits on.

## Modules

| Module                                   | Owns                                                                      | Seam          |
| ---------------------------------------- | ------------------------------------------------------------------------- | ------------- |
| `services/invite.service.ts`             | preview, validate, and decision calls; one outcome mapping                | `ApiClient`   |
| `services/invite-token-proxy.service.ts` | token-to-cookie redirect for the root proxy                               | `NextRequest` |
| `services/invite-token.service.ts`       | reads the token cookie for the page                                       | `cookies()`   |
| `schemas/invite.schema.ts`               | strips responses to the fields screens render                             | none          |
| `schemas/invite-token.schema.ts`         | token bounds, checked on the way in and on every read                     | none          |
| `types/invite.types.ts`                  | the rendered picks of the generated DTOs, and `InviteProblem`             | none          |
| `hooks/use-accept-invite.ts`             | the accept mutation, analytics, full-load navigation                      | `browserApi`  |
| `components/`                            | offer, confirmation, details, one notice per problem, Google sign-in link | none          |

Reads run in Server Components and call the service directly: nothing
refetches them, so a query layer would add only a loading state. The accept
runs in the browser through `/api`, because only the proxy sets auth cookies.

## Contributing

### Adding an outcome

1. Add the problem to `InviteProblem` in `types/invite.types.ts`.
2. Map its status or error code once in `invite.service.ts`.
3. Give it a notice in `invite-problem-notice.tsx`.
4. Add the answer to `tests/evals/invitation.eval.test.tsx`.

### Rules

- The accept never retries: a lost response is indistinguishable from a
  second answer. The button stays disabled after success.
- `already-accepted` links to Google, never `/sign-in` (sign-in would loop
  back to `/preview`).
- The token never reaches client JavaScript or a rendered URL: the proxy moves
  it into the cookie before render, and the page sends no Referer.
- The token cookie lives until the first of: a sign-in that starts a session,
  a new or unusable invite link, or 30 minutes. A failed sign-in keeps it so
  the invitee can retry. Set, delete, and expire it only through
  `INVITE_TOKEN_COOKIE_SCOPE`; any other path leaves it in the browser.
- Invite reads keep only the fields screens render; the public preview never
  holds the invitee's email. Widen a schema in `invite.schema.ts` and in
  `tests/evals/data-privacy.eval.test.ts` together.
- A successful accept captures `auth.verification_completed` once.
- Use `GLOSSARY.md` terms (Invite Link, Invite Preview, Invitation).
- Comment only a non-obvious why.

### Known gaps

- "Flag an Issue" has no backend; Decline is not wired.
- The token still reaches host access logs on the first request, until
  campus-api changes the link shape.

## Tests

```bash
pnpm vitest run --project unit features/invitation "app/(auth)/invitation"
pnpm eval:invitation
pnpm eval:privacy
pnpm build && pnpm playwright test tests/e2e/invitation.spec.ts
```

`eval:invitation` walks every backend answer on all three routes and fails on
a mismatched screen or a second accept per click.
