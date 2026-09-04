# Campus by Rise

Frontend for the Campus by Rise persistent 2D learning environment.

The repository currently contains architecture and development tooling only.
Product UI and feature implementations begin after design and contract approval.

## Requirements

- Node.js 22.12 or newer
- pnpm

## Getting Started

```bash
corepack enable
pnpm install
pnpm exec playwright install
pnpm dev
```

## Architecture

- `app/`: routes, layouts, boundaries, providers, and composition
- `core/`: API, game, media, and realtime infrastructure
- `features/`: independently owned product domains
- `shared/`: reusable domain-independent code
- `assets/`: imported images, SVGs, and fonts

Dependencies flow in one direction:

```text
app -> features -> core -> shared
 |         |         |
 +---------+---------+----> shared
```

Features cannot import other features. Route composition resolves cross-feature
workflows. Consumers import a feature through `@/features/<feature>`.

See `docs/architectural-plan.md` and
`docs/plans/frontend-architecture-scaffold.md`.

## Quality Commands

| Command                  | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `pnpm check`             | Lint, typecheck, format-check, unit-test, and build |
| `pnpm check:all`         | Run the full gate, including E2E                    |
| `pnpm test`              | Run deterministic unit and architecture tests       |
| `pnpm test:coverage`     | Generate V8 coverage                                |
| `pnpm test:e2e`          | Build and run Playwright across three browsers      |
| `pnpm eval:architecture` | Require zero lint or boundary violations            |
