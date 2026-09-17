# Railway infrastructure

The shared topology in `.railway/stack.ts` owns the `campus-frontends`
partial:

- `campus-web`
- `campus-storybook`

It does not own `campus-api`, `campus-world`, PostgreSQL, volumes, generated
domains, or other project resources.

Railway CLI issue `railwayapp/cli#1137` currently prevents the documented
environment context from selecting branches. Two thin entry files provide the
required source configuration:

| Environment | Entry file                       | Branch |
| ----------- | -------------------------------- | ------ |
| staging     | `.railway/railway.ts`            | `dev`  |
| production  | `.railway/railway.production.ts` | `main` |

Both entries use `Risevestacademy/campus-web` with Wait for CI enabled. The
linked Railway environment selects the target; the entry filename does not.
Always verify `railway status` before planning or applying.

## Variables

`campus-web` preserves its Railway-managed values:

- `API_BASE_URL`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`

`campus-storybook` owns only:

```text
RAILPACK_SPA_OUTPUT_DIR=storybook-static
```

Never place decrypted environment values in this directory.

## Local verification

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm eval:railway
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

The Railway eval must report 5/5 passing cases.

## Staging

Link at project scope and verify the target before every plan or apply:

```bash
railway link \
  --project campus-by-rise \
  --environment staging
railway status
railway config plan
```

The initial staging plan should:

- Remove `API_BASE_URL`, `NEXT_PUBLIC_POSTHOG_HOST`, and
  `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` from `campus-storybook`.
- Move the Storybook source from `feat/storybook` to `dev`.
- Enable Wait for CI on the Storybook source.
- Leave the `campus-web` source unchanged.

Do not apply until the Storybook configuration fix is deployed from `dev`.
Applying requires separate explicit approval.

After an approved apply:

1. Confirm the Storybook source is `dev` with Wait for CI enabled.
2. Verify its generated Railway URL after deployment.
3. Run `railway config plan` again and require no unintended changes.

## Production

Production currently has no `campus-storybook` service. First review:

```bash
railway link \
  --project campus-by-rise \
  --environment production
railway status
railway config plan --file .railway/railway.production.ts
```

The production plan should leave `campus-web` unchanged and create only
`campus-storybook`, connected to `main` with Wait for CI enabled. Do not apply
without separate production approval.

After an approved production apply, verify the deployment and generate a
Railway domain if Railway did not create one automatically. Domain creation is
a separate production action and requires confirmation.

## Recovery

If a plan contains API, database, world, volume, domain, or unexpected web
changes, do not apply it.

If a staging apply is wrong:

1. Stop further deploys.
2. Restore the previous IaC revision.
3. Restore removed variables from the environment's secure source if needed.
4. Review a new plan before another apply.

If the new production Storybook service is wrong, stop its deployments and
review the rollback plan. Do not delete production resources without explicit
confirmation.
