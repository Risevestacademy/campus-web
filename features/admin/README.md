# Administration

Owns System Administrator workflows under the `/campus` route hierarchy.
The Cohort module provides catalogue, create, edit, and guarded-delete
workflows.

## Public interface

```tsx
import { CohortCatalogue } from "@/features/admin";

<CohortCatalogue page={page} />;
```

The interface accepts the requested page and hides transport clients, response
validation, domain outcomes, mutation policy, analytics, and navigation.
`app/campus/page.tsx` renders it only for a System Administrator.

## Cohort catalogue

The catalogue reads `GET /v1/cohorts?page=N` in a Server Component. Invalid
page values fall back to page 1.

| Backend answer | Administrator sees                        |
| -------------- | ----------------------------------------- |
| Valid page     | Create tile, Cohort cards, and pagination |
| Empty page     | Empty explanation and the create tile     |
| Failure        | Alert and a full-request Try again link   |

Admin owns `CohortAdministrationCard`; Campus keeps a separate member-facing
card. Active Campus remains the Admin card's primary destination. Its explicit
administration menu exposes Edit and Delete without changing member behavior.

## Creating a Cohort

The create tile is a client island inside the server-rendered catalogue. It
sends `POST /v1/cohorts` through the browser `/api` proxy.

```text
CreateCohortTile → CreateCohortForm → parseNewCohort
                 → useCreateCohort → cohort-api adapter
```

| Field      | Rule                                                     |
| ---------- | -------------------------------------------------------- |
| Name       | required, trimmed                                        |
| Code       | required, trimmed, uppercased (shown uppercase as typed) |
| Start, End | optional `YYYY-MM-DD`; omitted when empty; end ≥ start   |
| Status     | Upcoming (default), Active, or Completed                 |

| Backend answer    | Administrator sees                                        |
| ----------------- | --------------------------------------------------------- |
| 201               | dialog closes, confirmation, newest catalogue page        |
| 400               | form alert explaining that the details were rejected      |
| 401               | full load to `/sign-in`                                   |
| 409               | Code error explaining that the code is already used       |
| 403, 5xx, network | failure toast; dialog and entered values remain available |

- Page 1 refreshes after creation; later pages navigate to `/campus`.
- Mutations use `retry: false`.
- A synchronous in-flight gate permits at most one POST per submission.
- The dialog cannot close while its request is pending.
- Closing unmounts the form so the next open starts empty.
- campus-api remains the final authorization authority.

### Analytics

A successful creation records `cohort.created` once with `cohort_status`.

## Editing a Cohort

Edit reuses the create fields and validation but has a separate interface.
Only normalized changed fields are sent to `PATCH /v1/cohorts/{id}`. Clearing
an optional date sends `null`.

| Backend answer | Administrator sees                               |
| -------------- | ------------------------------------------------ |
| 200            | dialog closes, confirmation, refreshed catalogue |
| 400            | rejected-changes explanation; values remain      |
| 401            | full load to `/sign-in`                          |
| 403            | permission explanation; values remain            |
| 404            | missing-Cohort explanation; values remain        |
| 409            | duplicate-code field error; values remain        |
| 5xx, network   | failure toast; values remain                     |

## Deleting a Cohort

The confirmation names the Cohort and states that deletion is permanent and
non-cascading. The browser sends only `DELETE /v1/cohorts/{id}`.

| Backend answer | Administrator sees                               |
| -------------- | ------------------------------------------------ |
| 204            | dialog closes, confirmation, refreshed catalogue |
| 401            | full load to `/sign-in`                          |
| 403            | permission explanation; dialog remains           |
| 404            | missing-Cohort explanation; dialog remains       |
| 409            | attached-record explanation; dialog remains      |
| 5xx, network   | failure toast; dialog remains                    |

A 409 never triggers Programme Track, membership, Invitation, or other cleanup
requests. The backend remains authoritative for whether the Cohort is empty.

Both mutations use `retry: false` and a synchronous in-flight gate, so repeated
submission sends at most one request.

## Internal transport

- Server catalogue reads use `getServerApi()`.
- Browser mutations use `browserApi`.
- `cohort-api.adapter.ts` maps raw responses to Admin-owned domain outcomes.
- Neither raw transport client is part of the public Admin interface.
- If the generated PATCH/DELETE status or body contracts change, TypeScript
  catches request-shape changes and the adapter contract tests catch changed
  runtime outcomes.

## Tests

```bash
pnpm vitest run --project=unit features/admin
pnpm eval:cohort-create
```

The eval renders the public Admin catalogue, double-submits every backend
answer, and requires zero mismatched outcomes, at most one POST per valid
submission, and zero POSTs for invalid input.
