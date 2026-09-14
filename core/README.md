# Core

Framework-independent infrastructure shared by multiple features belongs here.

Implemented concerns:

- `analytics`: typed browser and server product analytics. See
  `analytics/README.md`.
- `api`: inbound HTTP contracts plus the generated, typed Campus backend client
  and browser proxy. See `api/README.md`.
- `observability`: structured application logging. See
  `observability/README.md`.

Planned concerns are `game`, `media`, and `realtime`. Create each concern only when its first
implementation is required.

Core may import from `shared`. It must never import from `features` or `app`.
