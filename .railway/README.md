# Railway infrastructure

The shared topology in `.railway/stack.ts` owns the `campus-frontends`
partial:

- `campus-web`
- `campus-storybook`

It does not own `campus-api`, `campus-world`, PostgreSQL, volumes, generated
domains, or other project resources.

The single `.railway/railway.ts` entry reads Railway's environment context and
fails closed for every environment except the two supported targets:

| Environment | Branch |
| ----------- | ------ |
| staging     | `dev`  |
| production  | `main` |

Both targets use `Risevestacademy/campus-web` with Wait for CI enabled. Always
verify `railway status` before planning or applying locally.

## CI/CD

Railway configuration and application deployment are separate operations:

- `.github/workflows/railway-plan.yml` plans `.railway/**` changes on pull
  requests targeting `dev` or `main`.
- `.github/workflows/railway-apply.yml` applies the exact reviewed plan after
  the pull request merges. A direct push without a saved plan fails closed.
- This split Plan/Apply layout follows Railway's documented workflow. Required,
  up-to-date PR CI protects the merge; configuration Apply does not wait for a
  repeated post-merge CI run.
- Both jobs use `deployment: false`. They can read their GitHub environment's
  `RAILWAY_TOKEN` without creating misleading GitHub deployment records.
- Both jobs pin Railway CLI `5.63.1`, the version verified with the
  environment-scoped project token.
- Destructive applies are disabled. Resource deletion requires a separately
  reviewed manual operation.
- Railway's GitHub integration remains responsible for application builds and
  deployments. Its Wait for CI setting holds application deployments until all
  workflows for the commit pass. Do not add `railway up` to GitHub Actions.

Create a different environment-scoped Railway project token named
`RAILWAY_TOKEN` in each GitHub environment:

- `campus-by-rise / staging`
- `campus-by-rise / production`

Protect production with required reviewers for both plan and apply. GitHub App
custom deployment protection rules are incompatible with `deployment: false`.
If either GitHub environment restricts deployment branches, allow its target
branch (`dev` or `main`) and `refs/pull/*/merge`; plan jobs run on pull-request
merge refs even though the workflow selects the environment from the base
branch.
Railway service deployments remain the authoritative deployment records;
`campus-web` and `campus-storybook` deploy independently.

## Variables

`campus-web` reaches the API service in the same Railway environment through
private networking:

```text
API_BASE_URL=http://${{campus-api.RAILWAY_PRIVATE_DOMAIN}}:${{campus-api.PORT}}
```

Railway resolves the reference independently in staging and production. Both
environments must contain a service named `campus-api`. That service must
declare `PORT` as an explicit Railway service variable matching its listening
port; staging currently uses `PORT=8080`.

Do not rely only on the `PORT` injected into the running API container or the
port selected under Public Networking. Those values do not guarantee that
`${{campus-api.PORT}}` is available during cross-service reference
interpolation. If it is unavailable, `API_BASE_URL` resolves with a trailing
colon, Node attempts port 80, and the frontend proxy returns
`502 API is unavailable`.

Verify the resolved value from the deployed frontend:

```bash
railway ssh \
  --service campus-web \
  --environment staging

printf '%s\n' "$API_BASE_URL"
```

It must end in a numeric port, for example:

```text
http://campus-server.railway.internal:8080
```

The API repository owns the `PORT` contract. Capture it in the backend Railway
IaC for every environment instead of maintaining it only in the dashboard.

`campus-web` preserves its Railway-managed public values:

- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`
- `NEXT_PUBLIC_SANITY_DATASET`
- `NEXT_PUBLIC_SANITY_PROJECT_ID`

In staging only, `campus-web` also owns:

```text
NEXT_TELEMETRY_DISABLED=1
```

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
pnpm build
```

The Railway eval must report 8/8 passing cases.

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
- Set `campus-web` `API_BASE_URL` to the environment-local `campus-api`
  private-network reference.
- Move the Storybook source from `feat/storybook` to `dev`.
- Enable Wait for CI on the Storybook source.
- Leave the `campus-web` source unchanged.

Do not merge until the Storybook configuration fix is ready on `dev`. Merging
the reviewed pull request authorizes the non-destructive staging apply.

After an approved apply:

1. Confirm the Storybook source is `dev` with Wait for CI enabled.
2. Verify its generated Railway URL after deployment.
3. Run `railway config plan` again and reject unintended changes. Railway CLI
   issue [#992](https://github.com/railwayapp/cli/issues/992) can repeatedly
   report unchanged literal variables, so do not use zero drift as the only
   success signal.

## Staging serverless

Staging `campus-web` and `campus-storybook` sleep after sustained inactivity
and wake on the next request. Production stays always-on; the eval proves its
output is unchanged.

- `campus-web`: `sleepApplication`, `startCommand: pnpm start`,
  `healthcheck: /`, `NEXT_TELEMETRY_DISABLED=1`.
- `campus-storybook`: `sleepApplication`. Railpack already serves
  `storybook-static` through Caddy, never `storybook dev`.

Railway decides inactivity from outbound packets. Anything that calls out on a
timer keeps the container awake. The web server has no timers today:
`posthog-node` sends per request (`flushInterval: 0`) and has no personal API
key, so it never polls feature flags. Keep it that way.

The healthcheck runs only at deploy time and does not keep the service awake.
It targets `/`, a static page, so web deploys do not depend on `campus-api`.

### Runbook

The normal apply path is the reviewed GitHub Actions workflow. For local
diagnosis, run from your shell with `railway status` showing staging. Reject a
plan that touches `campus-api`, `campus-world`, databases, volumes, domains, or
production.

```bash
railway config plan
```

Do not run a local apply without separate explicit approval.

After 10+ idle minutes, both services should report `Status: SLEEPING`:

```bash
railway service status --service campus-web --environment staging
railway service status --service campus-storybook --environment staging
```

Then measure a cold load and a warm load:

```bash
curl -o /dev/null -s -w '%{http_code} %{time_total}s\n' https://dev.campusbyrise.com/
curl -o /dev/null -s -w '%{http_code} %{time_total}s\n' https://dev.campusbyrise.com/
```

The cold load passes with a 2xx within 10 seconds. One leading `502` is
tolerated while the container boots, if the next request returns 2xx and both
together take 10 seconds or less.

After a representative session, record memory:

```bash
railway metrics --service campus-web --environment staging --memory --since 1d
railway metrics --service campus-storybook --environment staging --memory --since 1d
```

If the cold load fails, do not disable Serverless. Read the deployment logs
for slow boot work first:

```bash
railway logs --deployment --service campus-web --environment staging --lines 200
```

If a service never sleeps, inspect its outbound traffic:

```bash
railway logs --network --service campus-web --environment staging --since 30m
```

### Cost controls

Set a soft workspace usage alert only. A hard limit takes every workspace
service offline, backend included.

```bash
railway usage limit set --target workspace --soft <amount>
```

No memory limit is set yet. Add `deploy.limitOverride` only after a week of
serverless memory data, above the observed peak with headroom.

On 2026-10-03 staging had no preview or duplicate frontend services, and the
project had no environments besides `production` and `staging`.

### Staging cost baseline

| Date       | Target      | Cold load | Warm load | Gate |
| ---------- | ----------- | --------- | --------- | ---- |
| 2026-10-03 | web /       | 200 2.31s | 200 0.76s | pass |
| 2026-10-03 | storybook / | 200 2.59s | 200 0.51s | pass |

| Date       | Service          | Label  | 24h average | 24h peak |
| ---------- | ---------------- | ------ | ----------- | -------- |
| 2026-10-03 | campus-web       | before | 229 MB      | 563 MB   |
| 2026-10-03 | campus-storybook | before | 40 MB       | 81 MB    |
| 2026-10-04 | campus-web       | demo   | 379 MB      | 699 MB   |
| 2026-10-04 | campus-storybook | demo   | 54 MB       | 67 MB    |

The 2026-10-04 rows cover a live demo day, so they show load, not idle
savings. Size any future memory limit from the 699 MB peak.

Idle days after the change cut project spend by about 31%. Check cost in the
Railway dashboard or with `railway usage projects --project campus-by-rise`;
billing figures stay out of this public repository.

## Production

Production stays always-on. Serverless, the pinned start command, the web
healthcheck, and `NEXT_TELEMETRY_DISABLED` are staging-only until production
gets its own cost review.

Production currently has no `campus-storybook` service instance. Railway CLI
issue [#1170](https://github.com/railwayapp/cli/issues/1170) can return exit
code zero when an IaC apply fails to add a service that exists elsewhere in the
project. Reconcile the topology before approving production:

1. Complete and verify the staging canary.
2. In the Railway dashboard, switch to production and use Environment Sync to
   bring only `campus-storybook` from staging into production.
3. Review the staged Railway change and obtain separate production approval
   before deploying it.
4. Refresh the production pull request after the sync so its plan captures the
   new production configuration etag.

Then verify the target locally if needed:

```bash
railway link \
  --project campus-by-rise \
  --environment production
railway status
railway config plan
```

The production plan should set `campus-web` `API_BASE_URL` to the
environment-local `campus-api` private-network reference, otherwise leave
`campus-web` unchanged, and reconcile `campus-storybook` to `main` with Wait for
CI enabled and always-on runtime settings. The protected production apply job
requires approval after merge.

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
