# Administration

Owns System Administrator work under `/campus`: the Cohort and Programme
Track catalogues and their mutations, Cohort Track attachment, and the Cohort
Administration pages. Member Cohort selection belongs to `campus`; Invitation
acceptance belongs to `invitation`.

## Interface

`index.ts` is the only entry point.

| Export                         | Composed by                                 |
| ------------------------------ | ------------------------------------------- |
| `AdministrationCatalogue`      | `app/campus/page.tsx`                       |
| `AdminSidebar`                 | both `app/campus/[id]` layouts              |
| `CohortAdministrationOverview` | `app/campus/[id]/(administration)/overview` |
| `FeedbackAdministration`       | `app/campus/[id]/(administration)/feedback` |
| `CohortTrackAdministration`    | `app/campus/[id]/(administration)/tracks`   |
| `CohortCatalogue`              | the Cohort create eval                      |

Every route requires `requireRouteAccess({ kind: "system-admin" })` before
rendering an export.

## Modules

| Module       | Owns                                                                                                                                                                                                                                                                                              | Seam                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `cohorts/`   | Cohort CRUD, Cohort Track attach and detach                                                                                                                                                                                                                                                       | `services/cohort-api.adapter.ts`, `services/cohort-track-api.adapter.ts` |
| `tracks/`    | Programme Track CRUD                                                                                                                                                                                                                                                                              | `services/track-api.adapter.ts`                                          |
| `catalogue/` | the `/campus?view=&page=` switch plus shared pagination and unavailable-state presentation                                                                                                                                                                                                        | none                                                                     |
| `overview/`  | the Administration overview's cards; the open-feedback cards read real counts through `feedback/`, the stat and schedule figures are mock data in `overview-data.ts` until campus-api has stats                                                                                                   | none                                                                     |
| `feedback/`  | the Feedback & reports page: queue, report table, detail, resolve and reopen; a report's person is its linked account and `about` is where it happened. The queue merges the newest 100 of each kind, so it stops paging there by design and says so. `index.ts` is the surface the overview uses | `services/feedback-api.adapter.ts`                                       |
| root files   | `use-admin-mutation.ts`, `admin-sidebar.tsx`, `cohort-administration-overview.tsx`, `cohort-administration-href.ts`                                                                                                                                                                               | none                                                                     |

Inside a module: `components/` → `hooks/` → `services/`. `schemas/` parses
form and response data; `types/` holds outcomes. Server Components read with
`getServerApi()`; client hooks mutate with `browserApi`.

## Contributing

### Adding a read

1. Outcome type in `types/`: `({ kind: "loaded" } & Data) | { kind: "unavailable" }`.
2. Adapter in `services/` taking `ApiClient`; parse with a `schemas/`
   function. A throw or a bad body is `unavailable`. Bind the response schema
   with `z.toZod` to a `Simplify<Pick<Dto, …>>` type; take enums and
   pagination meta from `@/core/api/schemas`.
3. Call it from a Server Component.

### Adding a mutation

1. Problem union in `types/`, one per mutation, extending the module's
   `…RecordProblem`.
2. Adapter maps statuses to problems and never throws.
3. Hook wraps `useAdminMutation` with `browserApi` and adds only the success
   toast.
4. Component maps every problem in a complete
   `Record<Problem, string | undefined>`. `signed-out` is `undefined` because
   the hook navigates to `/sign-in`.
5. Add the mutation to `tests/evals/admin-mutations.eval.test.tsx`.

### Adding a Cohort Administration page

1. Page in `app/campus/[id]/(administration)/<page>/`; it calls
   `requireRouteAccess({ kind: "system-admin" })` itself.
   The page passes `?page=` as text to the one feature component it renders,
   which parses it once with `parsePageNumber` from
   `@/shared/lib/search-params` and passes the `number` down; catalogues
   never take URL text.
2. Add `<page>` to `CohortAdministrationPage` in
   `cohort-administration-href.ts` and a link in `admin-sidebar.tsx`.
3. Follow "Protecting a new page" in `features/auth/README.md`;
   `pnpm eval:route-protection` fails until it is done.

### Rules

- Import no other feature; routes pass Auth and Campus UI in.
- Transport clients never leave `services/` or a Server Component.
- Cohort and Programme Track cards stay explicit; share only stable catalogue
  framing rather than introducing a generic catalogue abstraction.
- Mutations never retry, never update optimistically, and never cascade on a 409. campus-api stays the authorization authority.
- Use `GLOSSARY.md` terms. Inside admin, Programme Track may shorten to
  `track`; next to media code, say `programmeTrack`.
- Comment only a non-obvious why.

## Tests

```bash
pnpm vitest run --project=unit features/admin
pnpm eval:admin
```

`eval:admin` replays every backend answer for every mutation and requires the
documented outcome with exactly one request, plus the admin layout and sidebar.
