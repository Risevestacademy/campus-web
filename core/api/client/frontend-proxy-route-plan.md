# Frontend API proxy route plan

## Outcome

Browser API requests preserve backend paths beneath one frontend
gateway prefix:

```text
GET /api/v1/health
  -> GET ${API_BASE_URL}/v1/health
```

The previous `/api/campus/*` namespace is removed without a compatibility
alias.

## Implementation

1. Configure `browserApi` with `/api`.
2. Move the catch-all Route Handler to `app/api/[...path]/route.ts`.
3. Preserve the proxy's existing path, query, authentication, streaming,
   privacy, error, and observability behavior.
4. Update tests, the API client eval, and documentation.
5. Regenerate Next route types before TypeScript validation so route moves
   cannot leave stale validator imports.

## Verification

The human operator runs each command:

```bash
pnpm vitest run core/api/client/browser.test.ts
pnpm vitest run core/api/client/browser.test.ts 'app/api/[...path]/route.test.ts'
pnpm eval:api-client
pnpm check
```

The first browser-client test run must fail with the existing
`/api/campus/v1/health` URL before the implementation changes. All subsequent
verification must pass.

After deployment:

```bash
curl -i https://campus-web-staging.up.railway.app/api/v1/health
```

The request must return the backend health document and an `x-request-id`
header.
