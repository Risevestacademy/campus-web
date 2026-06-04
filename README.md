# Next.js Template

This is a Next.js 16 template using the App Router, TypeScript, ESLint, Prettier, Husky, `lint-staged`, and commitlint.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm lint:fix
pnpm typecheck
pnpm format
pnpm format:check
pnpm check
pnpm commitlint
pnpm fix
```

## Script Purpose

- `pnpm dev` starts the local development server.
- `pnpm build` creates a production build.
- `pnpm start` serves the production build.
- `pnpm lint` runs ESLint across the repository.
- `pnpm lint:fix` runs ESLint with automatic fixes.
- `pnpm typecheck` runs TypeScript in no-emit mode.
- `pnpm format` formats the repository with Prettier.
- `pnpm format:check` verifies formatting without changing files.
- `pnpm check` runs lint, typecheck, and format checks.
- `pnpm commitlint <commit-message-file>` validates a commit message file.
- `pnpm fix` runs auto-fixable maintenance tasks.

## Git Hooks

Husky is configured with `pre-commit` and `commit-msg` hooks.

Before commit creation, `lint-staged` runs against staged files only:

- ESLint with `--fix` for JavaScript and TypeScript files
- Prettier `--write` for supported staged files

Commit messages are validated with commitlint using the Conventional Commits preset.

This keeps commits fast while `pnpm check` remains available for full-repository validation.

## Notes

- ESLint uses the flat config format required by Next.js 16.
- Prettier is configured with `prettier-plugin-tailwindcss`.
