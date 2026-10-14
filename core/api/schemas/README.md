# API schemas

Runtime Zod schemas for Campus API vocabulary that more than one feature
reads: session scopes, roles, and the error envelope. Each schema is bound to
its generated OpenAPI type with `z.toZod`, so a value added or removed upstream
fails `pnpm typecheck` here instead of drifting silently.

## Interface

```ts
import {
  cohortRoleSchema,
  parseExceptionCode,
  type Simplify,
} from "@/core/api/schemas";
```

- `sessionScopeSchema`, `systemRoleSchema`, `cohortRoleSchema`,
  `exceptionCodeSchema`: enums equal to the generated types.
- `parseExceptionCode(body)`: the `error.code` of an API error body, or
  `undefined` for anything else.
- `Simplify<T>`: flattens a `Pick<…> & {…}` type so `z.toZod` can compare
  it with a schema's inferred output.

## Rules

- Bind every schema to its generated type with `z.toZod`. Never copy enum
  literals into a feature.
- A feature schema that validates a response strips to the fields the feature
  reads (`z.object`) and returns `parsed.data`, typed as
  `Simplify<Pick<Dto, …>>`.
- Only vocabulary shared by two or more features lives here. A feature's own
  response shapes stay in its `schemas/` folder.

## Tests

```bash
pnpm vitest run --project unit core/api/schemas
```
