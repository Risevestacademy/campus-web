# API client

This directory owns the typed outbound connection to the Campus backend. It is
separate from the inbound Route Handler contracts in the parent directory.

`createApiClient` is the only client factory. Runtime composition supplies its
base URL and request defaults:

- browser code uses `/api` and reaches the backend through the Next.js
  proxy;
- server code uses `API_BASE_URL` and reaches the backend directly.

Feature infrastructure adapters accept the configured client as a dependency.
They implement narrow domain gateway contracts and translate backend DTOs and
errors before returning to application services or hooks. They do not read
cookies, select a runtime, or duplicate client and server methods.

Authentication uses the backend-owned HTTP-only cookies `campus_session`,
`campus_refresh`, and `campus_oauth_state`. Browser JavaScript cannot read
them. The Next.js proxy forwards only those named cookies and never stores
credentials in mutable module state. The direct server adapter forwards only
`campus_session`.

Generated OpenAPI types live in `generated/schema.ts`. Do not edit that file.
Regenerate it with:

```bash
pnpm api:types
```

The command loads `.env.local` and derives the schema URL as
`${API_BASE_URL}/docs-json`. The upstream OpenAPI document must remain
the source of truth for request and response shapes.

## Environment

Set the server-only backend origin in `.env.local`:

```bash
API_BASE_URL=https://api.example.com
```

For a backend running locally on port 3001:

```bash
API_BASE_URL=http://localhost:3001
```

Only loopback hosts may use plain HTTP. Non-loopback public origins must use
HTTPS.

Do not prefix this variable with `NEXT_PUBLIC_`. When both services run in the
same Railway project and environment, configure the frontend with a Railway
reference variable such as:

```bash
API_BASE_URL=http://${{campus-api.RAILWAY_PRIVATE_DOMAIN}}:${{campus-api.PORT}}
```

The `campus-api` service must expose `PORT` as an explicit Railway service
variable. A runtime-injected port or Public Networking target port is not
necessarily available to cross-service reference interpolation. See
`.railway/README.md` for deployment verification and troubleshooting.

Railway private traffic is encrypted by its network even though the service URL
uses `http`. The configuration accepts HTTP only for loopback hosts and
`*.railway.internal`; every other origin must use HTTPS. Private DNS is
available at runtime, not during the image build, so do not fetch the API while
generating the Next.js build.

The browser proxy also resolves `API_BASE_URL` at request time rather
than during Route Handler module evaluation. Builds therefore do not require
the runtime-only backend origin. A request made without runtime configuration
returns a sanitized, correlated `502`.

## Define a feature gateway once

Feature domains define a narrow application-facing gateway around the injected
`ApiClient`. Raw openapi-fetch results stay inside the adapter:

```ts
// features/system/api/system-gateway.ts
import type { ApiClient, components } from "@/core/api/client";

export interface SystemHealth {
  status: components["schemas"]["HealthStatus"];
}

export interface SystemGateway {
  getHealth(): Promise<SystemHealth>;
}

export function createSystemGateway(api: ApiClient): SystemGateway {
  return {
    async getHealth() {
      const result = await api.GET("/v1/health");

      if (result.error) {
        throw new Error("The Campus system health request failed.", {
          cause: result.error.error.code,
        });
      }

      return {
        status: result.data.status,
      };
    },
  };
}
```

OpenAPI generation makes unpublished paths and invalid request bodies fail
TypeScript compilation.

## Browser queries

Browser code injects `browserApi`. Its relative `/api` base URL
uses the Next.js proxy, and the browser includes the HTTP-only cookie without
exposing it to JavaScript:

```ts
// features/system/hooks/use-health-query.ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { browserApi } from "@/core/api/client/browser";

import { createSystemGateway } from "../api/system-gateway";

const systemGateway = createSystemGateway(browserApi);

export function useHealthQuery() {
  return useQuery({
    queryKey: ["api", "health"],
    queryFn: systemGateway.getHealth,
  });
}
```

Query hooks own browser cache and retry policy. The transport does not show
toasts or mutate UI state.

## Direct server requests

Server Components, Server Functions, Route Handlers, and feature application
services use the direct server composition:

```ts
import { getServerApi } from "@/core/api/client/server";

import { createSystemGateway } from "@/features/system/api/system-gateway";

const api = await getServerApi({ authentication: "none" });
const systemGateway = createSystemGateway(api);
const health = await systemGateway.getHealth();
```

Authenticated calls omit the option:

```ts
const api = await getServerApi();
```

The default reads `campus_session` with Next.js `cookies()` and forwards only
that cookie. It also forwards the visitor's `X-Forwarded-For` unchanged:
campus-api rate-limits per client address (`TRUST_PROXY_HOPS=1`), and without
it every server read would share the Next server's address and one bucket. A
new client is created for the request, so credentials and addresses cannot leak
between concurrent users. Use `authentication: "none"` for public data so
Next.js does not opt the render path into request-time rendering merely to read
cookies or headers.

Server code must not call the frontend `/api` proxy. That adds an unnecessary
network hop and complicates cookie forwarding and caching.

## Browser proxy

`app/api/[...path]/route.ts` is a policy-enforcing browser-facing proxy. It:

- fixes the upstream host from `API_BASE_URL`;
- forwards only allowlisted request and response headers;
- forwards only `campus_session`, `campus_refresh`, and
  `campus_oauth_state`;
- streams request and response bodies;
- rejects cross-origin unsafe methods;
- preserves backend `Location` headers while keeping upstream fetches in
  manual redirect mode;
- forwards the edge-provided `X-Forwarded-For` value;
- correlates requests with `x-request-id` and structured logs;
- returns a sanitized backend-shaped `502` when the upstream is unavailable;
- exposes only the three backend authentication cookies;
- keeps `campus_session` on `Path=/` and preserves its configured domain;
- rewrites `campus_refresh` and `campus_oauth_state` to
  `Path=/api/v1/auth` without a backend domain;
- enforces `HttpOnly`, `SameSite=Lax`, and `Secure` on HTTPS;
- forces authenticated responses to `Cache-Control: private, no-store`.

The proxy preserves backend success and error documents. It does not wrap them
in the inbound API foundation's `{ data, meta }` or problem contracts.

## Google OAuth

OAuth must begin with a browser navigation, not a client-side `fetch`:

```text
/api/v1/auth/google
```

An optional return destination may be supplied:

```text
/api/v1/auth/google?returnTo=/campus/42/rooms?seat=3
```

`createApiProxy` does not own the return policy. Its required `parseReturnTo`
option receives one, and `app/api/[...path]/route.ts` passes
`parseCampusReturnTo` from `@/features/auth`. `core` may not import
`features`, so injection keeps Campus rules out of the transport. That policy
accepts same-origin `/campus` and `/campus/**` destinations with their query
and rejects everything else (see `features/auth/README.md`).

The proxy stores the parsed destination, never the raw value, in the
short-lived, HTTP-only `campus_oauth_return_to` cookie, and parses the cookie
again on the callback. This frontend-only cookie is never forwarded to the
backend, and `returnTo` is removed from the upstream URL.

The Google callback must return through:

```text
/api/v1/auth/google/callback
```

When the backend redirects a full-access user to the frontend root, the proxy
redirects to the stored Campus destination or `/campus`. Backend invitation, sign-in
error, and unexpected destinations remain unchanged. The return cookie is
cleared on every callback response.

For local OAuth verification, run campus-api on a different port from Next.js:

```text
PORT=3001
APP_PUBLIC_URL=http://localhost:3000
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
CORS_ORIGINS=http://localhost:3000
TRUST_PROXY_HOPS=1
FF_GOOGLE_AUTH_ENABLED=true
```

`AUTH_COOKIE_DOMAIN` must be absent, not an empty value, so the local session
cookie remains host-only. Google OAuth must be enabled with the existing client
credentials and authentication secrets. The Google OAuth client must contain
the exact localhost callback URI.

Before starting the local backend, apply its committed database migrations.
To receive a full-access session on first sign-in, build and seed the backend
with `DEFAULT_ADMIN_EMAIL` set to the Google account being used, or sign in as
an existing active member or invited user. A provisional session intentionally
does not receive `campus_refresh`.

The browser-visible callback response is authoritative when diagnosing cookie
transport. A full-access callback must contain `campus_session` and
`campus_refresh`; the proxy rewrites the refresh path to `/api/v1/auth`.

Try the public health endpoint with the development server running:

```bash
curl -i http://localhost:3000/api/v1/health
```

Unsafe manual requests must include the frontend origin:

```bash
curl -i \
  -X PATCH http://localhost:3000/api/v1/example \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  --data '{}'
```

## Authorization and session refresh

Ownership is split so each concern has exactly one home:

| Concern                                                                            | Owner                                                            |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Issuing, rotating, and revoking `campus_session` and `campus_refresh`              | campus-api                                                       |
| Cookie scoping (`Path`, `HttpOnly`, `SameSite`, `Secure`) and the cookie allowlist | browser proxy (`proxy.ts`)                                       |
| `campus_refresh_attempted` marker                                                  | browser proxy sets it; `features/auth` reads it                  |
| Reading the session (`GET /v1/auth/me`), retries, route decisions                  | `features/auth` (`authorizeRoute`, server-only)                  |
| Refreshing the session (`POST /v1/auth/refresh`)                                   | `features/auth` refresh page, through `browserApi`               |
| Which Campus return destinations are safe                                          | `features/auth` (`parseCampusReturnTo`), injected into the proxy |

Rules:

- Server code reads the session directly with `getServerApi()`. It never
  refreshes: `campus_refresh` is scoped to `/api/v1/auth`, so only the
  browser can send it.
- The refresh POST happens only in the browser, at most once automatically,
  and never in parallel. Refresh tokens rotate; a second concurrent POST
  spends a used token and signs the visitor out.
- After a successful refresh the proxy adds
  `campus_refresh_attempted=1; HttpOnly; SameSite=Lax; Path=/campus; Max-Age=60`
  (`Secure` on HTTPS). A Campus route that still finds no session while the
  marker is present sends the visitor to sign-in instead of refreshing again.
  The marker is not in the cookie allowlist, so it never reaches the backend.
- The cookie name lives in `auth-cookies.ts` and is exported from
  `@/core/api/client`, so the proxy and `features/auth` share one definition.

## Errors, logging, and analytics

Backend HTTP failures remain typed OpenAPI results. Network failures on the
direct server path reject normally so the owning feature decides how to map
them. Network failures at the browser proxy become a sanitized `502` response.

Logs contain request ID, route, method, status, duration, and error name when
applicable. They never contain cookies, tokens, request bodies, or query values.

The API factory and proxy never emit PostHog events. The owning feature
application service emits a trusted event only after its business operation has
succeeded. Analytics delivery must not determine business success.

## Contract limitation

The current generated OpenAPI document does not describe the complete
cookie-based Google OAuth exchange. The proxy contract is therefore protected
by boundary tests and the API-client acceptance eval.
