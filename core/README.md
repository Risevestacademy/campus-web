# Core

Framework-independent infrastructure shared by multiple features belongs here.

Implemented concerns:

- `analytics`: typed browser and server product analytics. See
  `analytics/README.md`.

Planned concerns are `api`, `game`, `media`, and `realtime`. Create each
concern only when its first implementation is required.

Core may import from `shared`. It must never import from `features` or `app`.
