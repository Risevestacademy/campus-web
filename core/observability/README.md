# Observability

This concern owns provider-neutral structured logging.

Log low-cardinality route templates and request IDs. Do not log request bodies,
authorization headers, cookies, tokens, or provider session objects.

Next.js supplies baseline Route Handler spans. Add an OpenTelemetry exporter
only after the deployment target and observability backend are selected.

## Usage

Create the default logger at the Route Handler composition boundary and inject
it into the API handler:

```ts
import { createJsonLogger } from "@/core/observability";

const logger = createJsonLogger();
```

`createPublicRoute` and `createAuthenticatedRoute` write exactly one terminal
record for each handled request. Successful records go to standard output;
rejected and failed records go to standard error.

```json
{
  "durationMs": 4,
  "event": "api.request.completed",
  "level": "info",
  "method": "POST",
  "requestId": "019...",
  "route": "/api/example",
  "status": 200,
  "timestamp": "2026-09-09T12:00:00.000Z"
}
```

Use the low-cardinality route template, such as `/api/profiles/[id]`, rather
than the requested URL containing a real resource ID.
