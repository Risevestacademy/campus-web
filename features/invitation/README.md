# Invitation

Owns what an invitee sees and does between opening the emailed link and
entering Campus: the public preview, the signed-in confirmation, and the
accept. `features/auth` decides who may reach each route; this feature decides
what renders there.

## Flow

```text
/invitation?token=…   POST /v1/invites/preview            no session; token is the proof
  Continue with Google → /api/v1/auth/google           full navigation
campus-api callback   → /invitation (no token)         hard-coded in campus-api
auth route policy     → /preview                       ResumeInvitation
/preview              GET /v1/invites/validate-user-invite
  Go to Campus        POST /v1/invites/decision         browser, through /api
full load             → /campus/{cohortId}/join, or /campus without a cohort
```

## Public interface

```tsx
import { InvitationOffer, InviteConfirmation } from "@/features/invitation";

// /invitation?token=…
<InvitationOffer api={await getServerApi()} token={token} />;

// /preview, inside InvitationGate
<InviteConfirmation api={await getServerApi()} />;
```

Both are async Server Components that take the server `ApiClient` from the
route, like `CohortChooser`. The preview needs no session, but campus-api
rate-limits per client address and only the default `getServerApi()` forwards
`X-Forwarded-For`, so routes pass that rather than `authentication: "none"`.

## Where each call runs

| Call                | Runs in                                   | Why                                                                                        |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `previewInvite`     | Server Component                          | One read the first paint needs; the token never reaches client JS                          |
| `readPendingInvite` | Server Component                          | Same, with the session cookie                                                              |
| `acceptInvite`      | Browser: `useAcceptInvite` → `browserApi` | Accept replaces the provisional cookie; only the `/api` proxy scopes and sets auth cookies |

This departs from the Component → Hook → Query → Service flow for the two
reads: nothing refetches or mutates them, so TanStack Query would add a
loading state and nothing else.

The accept mutation has `retry: false`. campus-api documents that re-sending a
decision is never the recovery: a lost response is indistinguishable from a
second answer. The button stays disabled after a successful accept so the
page cannot accept twice while the destination loads.

## Outcomes

`services/invite.service.ts` maps every answer once, for all three routes:

| Backend answer                                  | Problem            | Visitor sees                                              |
| ----------------------------------------------- | ------------------ | --------------------------------------------------------- |
| 401                                             | `signed-out`       | `/sign-in` (server `redirect`, or full load after accept) |
| 403                                             | `expired`          | "This invitation has expired"                             |
| 404                                             | `not-found`        | "We couldn't find this invitation"                        |
| 409 `INVITE_ALREADY_ACCEPTED`                   | `already-accepted` | Notice plus "Continue with Google"                        |
| 409 `INVITE_ALREADY_DECLINED`, `INVITE_REVOKED` | `closed`           | "This invitation is no longer active"                     |
| 409 `CONFLICT`                                  | `already-member`   | "You're already a member of this cohort"                  |
| other status, network failure, malformed body   | `unavailable`      | Reads: notice with Try again. Accept: error toast         |

`already-accepted` links to Google instead of redirecting to `/sign-in`: the
visitor still holds a provisional session with an invite, which sign-in sends
back to `/invitation`, then `/preview`, then this 409 again. A fresh Google
sign-in issues a full-access session and campus-api sends it to `/campus`.

After accept, a problem other than `signed-out` or `unavailable` replaces the
action buttons with the same notice (as an `h2`, under the page's `h1`).

## Analytics

A successful accept captures `auth.verification_completed` with
`verification_type: "invite"` before the full load. Nothing else is captured.

## Layout

| Path                                   | Role                                                       |
| -------------------------------------- | ---------------------------------------------------------- |
| `index.ts`                             | public interface for routes                                |
| `components/invitation-offer.tsx`      | token preview: copy, details, Continue with Google         |
| `components/invite-confirmation.tsx`   | signed-in details and the accept actions                   |
| `components/accept-invite-actions.tsx` | client: Flag an Issue (placeholder), Go to Campus          |
| `components/invite-problem-notice.tsx` | one notice per problem, with its action                    |
| `components/invite-read-problem.tsx`   | server read problems: notice, or redirect for `signed-out` |
| `components/invite-details.ts`         | which fields render, names, track + cohort, role labels    |
| `hooks/use-accept-invite.ts`           | accept mutation, analytics, navigation, failure toast      |
| `services/invite.service.ts`           | the three calls and the shared outcome mapping             |
| `schemas/invite.schema.ts`             | validates the fields screens render                        |
| `types/invite.types.ts`                | DTO aliases and outcome types                              |

## Tests

```bash
pnpm vitest run --project unit features/invitation "app/(auth)/invitation"
pnpm eval:invitation
pnpm build
pnpm playwright test tests/e2e/invitation.spec.ts
```

`pnpm eval:invitation` walks every backend answer for all three routes and
fails on any mismatched screen or any accept sent more than once per click.
Fixtures live in `tests/fixtures/invites.ts`; the Playwright fake API answers
the invite routes (`tests/e2e/support/fake-auth-api.mjs`).

## Known gaps

- "Flag an Issue" has no backend and does nothing.
- Decline is not wired.
- The token still reaches host access logs in `/invitation?token=…`. The page
  sets `referrer: no-referrer` so it never leaves as a Referer; removing it
  from the URL needs campus-api to change the link shape.
