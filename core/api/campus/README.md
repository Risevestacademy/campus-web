# Campus API client

This directory owns the typed outbound connection to the Campus backend. It is
separate from the inbound Route Handler contracts in the parent directory.

`createCampusApi` is the only client factory. Runtime composition supplies its
base URL and request defaults:

- browser code uses `/api/campus` and reaches the backend through the Next.js
  proxy;
- server code uses `CAMPUS_API_BASE_URL` and reaches the backend directly.

Feature infrastructure adapters accept the configured client as a dependency.
They implement narrow domain gateway contracts and translate backend DTOs and
errors before returning to application services or hooks. They do not read
cookies, select a runtime, or duplicate client and server methods.

Authentication uses the HTTP-only `accessToken` cookie. Browser JavaScript
cannot read it. The Next.js proxy and server adapter forward only that named
cookie and never store credentials in mutable module state.

Generated OpenAPI types live in `generated/schema.ts`. Do not edit that file.
Regenerate it with:

```bash
pnpm api:types
```

The command loads `.env.local` and derives the schema URL as
`${CAMPUS_API_BASE_URL}/docs-json`. The upstream OpenAPI document must remain
the source of truth for request and response shapes.

## Environment

Set the server-only backend origin in `.env.local`:

```bash
CAMPUS_API_BASE_URL=https://api.example.com
```

Do not prefix this variable with `NEXT_PUBLIC_`. When both services run in the
same Railway project and environment, configure the frontend with a Railway
reference variable such as:

```bash
CAMPUS_API_BASE_URL=http://${{campus-api.RAILWAY_PRIVATE_DOMAIN}}:${{campus-api.PORT}}
```

Railway private traffic is encrypted by its network even though the service URL
uses `http`. The configuration accepts HTTP only for `*.railway.internal`;
every public origin must use HTTPS. Private DNS is available at runtime, not
during the image build, so do not fetch the Campus API while generating the
Next.js build.

## Define a feature gateway once

Feature domains define a narrow application-facing gateway around the injected
`CampusApi`. Raw openapi-fetch results stay inside the adapter:

```ts
// features/system/api/system-gateway.ts
import type { CampusApi, components } from "@/core/api/campus";

export interface SystemHealth {
  status: components["schemas"]["HealthStatus"];
}

export interface SystemGateway {
  getHealth(): Promise<SystemHealth>;
}

export function createSystemGateway(api: CampusApi): SystemGateway {
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

Browser code injects `campusBrowserApi`. Its relative `/api/campus` base URL
uses the Next.js proxy, and the browser includes the HTTP-only cookie without
exposing it to JavaScript:

```ts
// features/system/hooks/use-health-query.ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { campusBrowserApi } from "@/core/api/campus/browser";

import { createSystemGateway } from "../api/system-gateway";

const systemGateway = createSystemGateway(campusBrowserApi);

export function useHealthQuery() {
  return useQuery({
    queryKey: ["campus-api", "health"],
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
import { getCampusServerApi } from "@/core/api/campus/server";

import { createSystemGateway } from "@/features/system/api/system-gateway";

const campusApi = await getCampusServerApi({ authentication: "none" });
const systemGateway = createSystemGateway(campusApi);
const health = await systemGateway.getHealth();
```

Authenticated calls omit the option:

```ts
const campusApi = await getCampusServerApi();
```

The default reads `accessToken` with Next.js `cookies()` and forwards only that
cookie. A new client is created for the request, so credentials cannot leak
between concurrent users. Use `authentication: "none"` for public data so
Next.js does not opt the render path into request-time rendering merely to read
cookies.

Server code must not call its own `/api/campus` URL. That adds an unnecessary
network hop and complicates cookie forwarding and caching.

## Browser proxy

`app/api/campus/[...path]/route.ts` is a transparent browser-facing proxy. It:

- fixes the upstream host from `CAMPUS_API_BASE_URL`;
- forwards only allowlisted request and response headers;
- forwards only the `accessToken` request cookie;
- streams request and response bodies;
- rejects cross-origin unsafe methods;
- prevents automatic upstream redirects;
- correlates requests with `x-request-id` and structured logs;
- returns a sanitized backend-shaped `502` when the upstream is unavailable;
- exposes only an upstream `accessToken` response cookie, removes its backend
  domain/path scope, and enforces `HttpOnly`, `SameSite=Lax`, frontend `Path=/`,
  and `Secure` on HTTPS;
- forces authenticated responses to `Cache-Control: private, no-store`.

The proxy preserves backend success and error documents. It does not wrap them
in the inbound API foundation's `{ data, meta }` or problem contracts.

Try the public health endpoint with the development server running:

```bash
curl -i http://localhost:3000/api/campus/v1/health
```

Unsafe manual requests must include the frontend origin:

```bash
curl -i \
  -X PATCH http://localhost:3000/api/campus/v1/example \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  --data '{}'
```

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

The deployed backend authenticates with `Cookie: accessToken=...`, while the
current OpenAPI description declares bearer authentication. Request and
response generation remains usable, but the backend specification must be
corrected to an `apiKey` security scheme with `in: cookie` and
`name: accessToken`.
