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
- `design-system/`: centralized Storybook foundation documentation
- `features/`: independently owned product domains
- `shared/`: reusable domain-independent code
- `assets/`: imported images, SVGs, and fonts

Dependencies follow these enforced boundaries:

| Source          | Allowed dependencies                  |
| --------------- | ------------------------------------- |
| `app`           | feature public APIs, `core`, `shared` |
| `features`      | `core`, `shared`                      |
| `core`          | `shared`                              |
| `design-system` | `shared`                              |
| `shared`        | none                                  |

Features cannot import other features. Route composition resolves cross-feature
workflows. Consumers import a feature through `@/features/<feature>`.

See the READMEs in `core/`, `features/`, `shared/`, and `assets/` for placement
and dependency rules.

### API foundation

Reusable HTTP contracts, validation, request authentication boundaries, and
error mapping live in `core/api`. Route Handlers remain thin composition roots:
they select an authentication adapter, parser, feature application service, and
logger.

Typed backend requests also live in `core/api/client`. Browser query
hooks use its same-origin `/api` proxy, while Server Components, Server
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

| Command                       | Purpose                                                  |
| ----------------------------- | -------------------------------------------------------- |
| `pnpm check`                  | Lint, typecheck, format-check, unit-test, and build      |
| `pnpm check:all`              | Run the full gate, including E2E                         |
| `pnpm test`                   | Run deterministic unit and architecture tests            |
| `pnpm test:coverage`          | Generate V8 coverage                                     |
| `pnpm test:storybook`         | Run stories in Chromium with interaction and a11y checks |
| `pnpm test:e2e`               | Build and run Playwright across three browsers           |
| `pnpm typecheck`              | Regenerate Next route types and run TypeScript           |
| `pnpm eval:api`               | Run the deterministic API contract eval                  |
| `pnpm eval:architecture`      | Require zero lint or boundary violations                 |
| `pnpm eval:analytics`         | Validate analytics events and project isolation          |
| `pnpm eval:api-client`        | Validate API client, proxy, and cookie isolation         |
| `pnpm eval:component-stories` | Require a story for every reusable UI primitive          |
| `pnpm eval:storybook`         | Run Storybook tests and build static documentation       |

## Storybook

Run `pnpm storybook` to develop and document UI components in isolation.
Reusable component stories live beside their components. Central foundation
documentation lives in `design-system/foundations/`.

Storybook imports `app/globals.css`, so application and documentation use the
same production CSS. It does not define independent design tokens.

### Adding a story

Place reusable domain-independent components in `shared/ui/`. Feature-aware
components and their stories stay inside `features/<feature>/components/`.
Only foundation documentation belongs in `design-system/foundations/`.

Keep generated primitives flat so their paths remain compatible with the
shadcn CLI. Colocate tests and stories by basename:

```text
shared/ui/
├── button.tsx
├── button.test.tsx
└── button.stories.tsx
```

Application-owned composite components may use a component directory when
they need multiple implementation files.

Use typed Component Story Format:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";

const meta = {
  title: "Primitives/Actions/Button",
  component: Button,
  args: {
    children: "Continue",
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
```

Prefer `args` over custom render functions. Name stories after real states or
scenarios and do not introduce variants that the production component does not
support. Use `play` functions for user interactions, query elements by
accessible role or label, and keep external data deterministic.

Every reusable visual component must document its meaningful visual,
responsive, keyboard, accessibility, and interaction states.

Verify Storybook changes with:

```bash
pnpm test:storybook
pnpm storybook:build
pnpm check
```

### Deploying Storybook

Storybook is not exposed through the deployed Next.js application. The
`pnpm storybook:build` command generates a static site in `storybook-static/`.
CI verifies the tests and static build. Deploy the generated directory through
any static hosting service.

Use:

- Build command: `pnpm storybook:build`
- Output directory: `storybook-static`
- Required build environment: none

Deploy Storybook separately from the Next.js application. Rebuild the
application for changes under `app`, `assets`, `config`, `core`, `features`, or
`shared`. Rebuild Storybook for changes under `.storybook`, `design-system`,
`assets`, `config`, `core`, `features`, or `shared`, and when
`app/globals.css` changes. Dependency and root build-configuration changes
should rebuild both.

Storybook must not receive PostHog variables or initialize analytics. Use
environment-specific PostHog values only for deployed Next.js application
services. Protect Storybook when it contains internal designs, and do not
commit `storybook-static/`.
