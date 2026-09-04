# Campus by Rise

Frontend for the Campus by Rise persistent 2D learning environment.

The repository currently contains architecture and development tooling only.
Product UI and feature implementations begin after design and contract approval.

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
- `core/`: API, game, media, and realtime infrastructure
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
| `pnpm eval:architecture` | Require zero lint or boundary violations            |
