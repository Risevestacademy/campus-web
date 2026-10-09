# Invitation

Owns what an invitee sees and does between opening the emailed Invite Link
and entering Campus: the public Invite Preview, the signed-in confirmation,
and the accept. `auth` decides who may reach each route; this feature decides
what renders there. Invitation administration will belong to `admin`.

## Interface

```tsx
import { InvitationOffer, InviteConfirmation } from "@/features/invitation";

// /invitation?token=…  (no session; the token is the proof)
<InvitationOffer api={await getServerApi()} token={token} />;

// /preview, inside InvitationGate
<InviteConfirmation api={await getServerApi()} />;
```

Both are async Server Components that take the route's server `ApiClient`.
Pass the default `getServerApi()`, not `authentication: "none"`: only it
forwards `X-Forwarded-For`, which campus-api rate-limits on.

## Modules

| Module                       | Owns                                                                      | Seam         |
| ---------------------------- | ------------------------------------------------------------------------- | ------------ |
| `services/invite.service.ts` | preview, validate, and decision calls; one outcome mapping                | `ApiClient`  |
| `schemas/invite.schema.ts`   | the fields screens render                                                 | none         |
| `types/invite.types.ts`      | generated DTO aliases and `InviteProblem`                                 | none         |
| `hooks/use-accept-invite.ts` | the accept mutation, analytics, full-load navigation                      | `browserApi` |
| `components/`                | offer, confirmation, details, one notice per problem, Google sign-in link | none         |

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
- The token never reaches client JavaScript; the page sends no Referer.
- A successful accept captures `auth.verification_completed` once.
- Use `GLOSSARY.md` terms (Invite Link, Invite Preview, Invitation).
- Comment only a non-obvious why.

### Known gaps

- "Flag an Issue" has no backend; Decline is not wired.
- The token reaches host access logs until campus-api changes the link shape.

## Tests

```bash
pnpm vitest run --project unit features/invitation "app/(auth)/invitation"
pnpm eval:invitation
pnpm build && pnpm playwright test tests/e2e/invitation.spec.ts
```

`eval:invitation` walks every backend answer on all three routes and fails on
a mismatched screen or a second accept per click.
