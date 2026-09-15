# API

This concern owns reusable HTTP transport policy.

Outbound calls to the backend use the generated client and browser BFF in
`client/`. See `client/README.md` for feature composition, cookie forwarding,
and OpenAPI generation. The contracts in this file describe endpoints owned by
the Next.js application rather than transparent backend responses.

Route Handlers in `app/api` are composition roots. They select a parser,
authentication adapter, feature application service, logger, and success
status, then export the resulting handler.

Feature services own business behavior, resource authorization, persistence,
and safe DTO construction. They receive validated inputs and an
`AuthenticatedActor`, not raw requests or provider session objects.

The owning feature application service also emits trusted PostHog events after
successful persistence by calling
`core/analytics/server.captureServerAnalyticsEvent`. Route Handlers do not
choose product event names and no analytics endpoints are created.

Use public handlers only when anonymous access is intentional. Protected
handlers authenticate before reading the request body. All dynamic route
parameters and query values remain untrusted and require endpoint schemas.
The parser receives the asynchronous Next.js route context so dynamic
parameters can be validated with the body and query values.

JSON media types are verified before body consumption. A declared
`Content-Length` above the endpoint limit is rejected before reading, while
undeclared or misleading bodies are read incrementally and cancelled as soon
as their cumulative bytes exceed the limit.

The default runtime is Node.js. Do not opt into Edge without an explicit
latency requirement and dependency compatibility review.

## Route Handler example

The following is an illustrative public endpoint for local verification. Do
not ship it as a product endpoint.

```ts
// app/api/example/route.ts
import { z } from "zod";

import { createPublicRoute, parseJsonBody } from "@/core/api";
import { createJsonLogger } from "@/core/observability";

const requestSchema = z.object({
  message: z.string().min(1, "Message is required."),
});

export const POST = createPublicRoute({
  routePattern: "/api/example",
  logger: createJsonLogger(),
  parse: (request) => parseJsonBody(request, requestSchema),
  execute: (input) =>
    Promise.resolve({
      echo: input.message,
    }),
});
```

Route Handlers must be named `route.ts` and live under `app`. Do not prefix a
route segment with `_`; Next.js treats underscore-prefixed directories as
private folders and excludes them from routing.

Test the example while the development server is running:

```bash
curl -i \
  -X POST http://localhost:3000/api/example \
  -H 'Content-Type: application/json' \
  --data '{"message":"hello"}'
```

A successful response has a `2xx` status, an `x-request-id` header, and this
shape:

```json
{
  "data": {
    "echo": "hello"
  },
  "meta": {
    "requestId": "<same value as x-request-id>"
  }
}
```

Invalid input returns `application/problem+json`. Its body and
`x-request-id` header contain the same request ID.

## Protected Route Handlers

Use `createAuthenticatedRoute` for protected endpoints. Provide the
authentication adapter separately from the feature service:

```ts
export const POST = createAuthenticatedRoute({
  authenticate: authenticateRequest,
  routePattern: "/api/example",
  logger: createJsonLogger(),
  parse: (request) => parseJsonBody(request, requestSchema),
  execute: (input, context) => featureService(input, context),
});
```

`authenticateRequest` converts the provider credential into an
`AuthenticatedActor`. The feature service receives that verified actor and
performs resource-level authorization. It must not trust actor IDs, roles, or
permissions supplied in the request body.

The shared handler authenticates before reading a protected request body,
maps expected `ApplicationError` failures to public problem responses, and
sanitizes unexpected failures.

## Dynamic route parameters

Dynamic parameters are asynchronous in the current Next.js version. Validate
them inside the route parser:

```ts
const routeParametersSchema = z.object({
  profileId: z.string().uuid(),
});

export const GET = createAuthenticatedRoute({
  authenticate: authenticateRequest,
  routePattern: "/api/profiles/[profileId]",
  logger: createJsonLogger(),
  parse: async (_request, routeContext) =>
    parseInput(routeParametersSchema, await routeContext.params),
  execute: (input, context) => getProfile(input.profileId, context),
});
```

## Analytics placement

Route Handlers do not send analytics merely because a request was received.
The owning feature service emits a typed trusted event only after its
repository or DAL confirms that the business operation succeeded. See
`core/analytics/README.md`.
