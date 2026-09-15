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

## Dependency Security

pnpm rejects unreviewed dependency build scripts. Approved and denied builds
are recorded in `pnpm-workspace.yaml`. Review each package and its install
script before changing this policy; do not approve all dependency builds
indiscriminately.

## Quality Commands

| Command                  | Purpose                                                  |
| ------------------------ | -------------------------------------------------------- |
| `pnpm check`             | Lint, typecheck, format-check, unit-test, and build      |
| `pnpm check:all`         | Run the full gate, including E2E                         |
| `pnpm test`              | Run deterministic unit and architecture tests            |
| `pnpm test:coverage`     | Generate V8 coverage                                     |
| `pnpm test:storybook`    | Run stories in Chromium with interaction and a11y checks |
| `pnpm test:e2e`          | Build and run Playwright across three browsers           |
| `pnpm eval:architecture` | Require zero lint or boundary violations                 |
| `pnpm eval:analytics`    | Validate analytics events and project isolation          |
| `pnpm eval:storybook`    | Run Storybook tests and build static documentation       |

## Storybook

Run `pnpm storybook` to develop and document UI components in isolation.
Reusable component stories live beside their components. Central foundation
documentation lives in `design-system/foundations/`.

Storybook imports `app/globals.css`, so application and documentation use the
same production CSS. It does not define independent design tokens.

### Adding a story

Place reusable domain-independent components in `shared/ui/<component>/`.
Feature-aware components and their stories stay inside
`features/<feature>/components/`. Only foundation documentation belongs in
`design-system/foundations/`.

Keep each reusable component colocated with its tests and stories:

```text
shared/ui/button/
├── button.tsx
├── button.test.tsx
└── button.stories.tsx
```

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
CI verifies that this build succeeds but does not currently publish or retain
the generated site.

Deploy `storybook-static/` as a separate static site when remote access is
required:

```text
Application → app.example.com
Storybook   → storybook.example.com
```

Use:

- Build command: `pnpm storybook:build`
- Output directory: `storybook-static`

Protect the Storybook deployment when it contains internal designs or
unreleased component states. Do not mount Storybook inside the production
Next.js application or commit the generated `storybook-static/` directory.
