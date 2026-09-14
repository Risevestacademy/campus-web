# Campus by Rise

Frontend for the Campus by Rise persistent 2D learning environment.

The repository contains the application scaffold, shared infrastructure, and
development tooling. Product features are added after design and contract
approval.

## Requirements

- Node.js 22.22.0, managed through `.nvmrc`
- pnpm 11.25.0, managed through Corepack

## Getting Started

```bash
nvm install
nvm use
corepack enable
corepack install
pnpm install
pnpm exec playwright install
pnpm check
pnpm dev
```

## Architecture

- `app/`: routes, layouts, boundaries, providers, and composition
- `config/`: architecture rules and build-time environment validation
- `core/`: analytics and other cross-feature infrastructure
- `features/`: independently owned product domains
- `shared/`: reusable domain-independent code
- `assets/`: imported images, SVGs, and fonts

Dependencies follow these enforced boundaries:

| Source     | Allowed dependencies                  |
| ---------- | ------------------------------------- |
| `app`      | feature public APIs, `core`, `shared` |
| `features` | `core`, `shared`                      |
| `core`     | `shared`                              |
| `shared`   | none                                  |

Features cannot import other features. Route composition resolves cross-feature
workflows. Consumers import a feature through `@/features/<feature>`.

See the READMEs in `core/`, `features/`, `shared/`, and `assets/` for placement
and dependency rules.

### API foundation

Reusable HTTP contracts, validation, request authentication boundaries, and
error mapping live in `core/api`. Route Handlers remain thin composition roots:
they select an authentication adapter, parser, feature application service, and
logger.

Typed Campus backend requests also live in `core/api/campus`. Browser query
hooks use its same-origin `/api/campus` proxy, while Server Components, Server
Functions, and Route Handlers use its direct server composition. Both paths are
created by one OpenAPI-backed factory; feature domains inject that client into
their API adapters instead of duplicating client and server methods.

Resource authorization and safe DTO construction remain inside the owning
feature service or data-access layer. Server Components call those services
directly rather than making HTTP requests to local Route Handlers.

Structured logging lives in `core/observability`. Trusted server analytics live
in `core/analytics`; they are emitted by feature application services only
after a successful business operation. Analytics delivery must not determine
whether the business operation succeeded.

## Dependency Security

pnpm rejects unreviewed dependency build scripts. Approved and denied builds
are recorded in `pnpm-workspace.yaml`. Review each package and its install
script before changing this policy; do not approve all dependency builds
indiscriminately.

## Quality Commands

| Command                  | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `pnpm check`             | Lint, typecheck, format-check, unit-test, and build |
| `pnpm check:all`         | Run the full gate, including E2E                    |
| `pnpm test`              | Run deterministic unit and architecture tests       |
| `pnpm test:coverage`     | Generate V8 coverage                                |
| `pnpm test:e2e`          | Build and run Playwright across three browsers      |
| `pnpm eval:api`          | Run the deterministic API contract eval             |
| `pnpm eval:architecture` | Require zero lint or boundary violations            |
| `pnpm eval:analytics`    | Validate analytics events and project isolation     |
| `pnpm eval:campus-api`   | Validate Campus client, proxy, and cookie isolation |
