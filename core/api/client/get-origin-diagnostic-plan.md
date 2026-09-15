# GET origin diagnostic plan

## Outcome

Temporarily apply the proxy's origin validation to GET requests to verify that
Railway exposes the external frontend origin through `request.url`.

## Expected behavior

- An origin-less GET returns `403`.
- A GET whose `Origin` matches `request.url` reaches the backend.
- A mismatched `Origin` returns `403`.
- POST, PUT, PATCH, and DELETE retain the same validation behavior.

## Rollback

After recording the staging result, restore `GET` to `SAFE_METHODS`, remove the
temporary diagnostic assertions and documentation, and rerun the complete
check.

## Verification

The human operator runs:

```bash
pnpm vitest run core/api/client/proxy.test.ts tests/evals/api-client-foundation.eval.test.ts
pnpm vitest run 'app/api/[...path]/route.test.ts'
pnpm check
```
