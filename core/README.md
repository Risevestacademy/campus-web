# Core

Framework-independent infrastructure shared by multiple features belongs here.

Implemented concerns:

- `analytics`: typed browser and server product analytics. See
  `analytics/README.md`.
- `api/client`: generated typed Campus API client, direct server composition,
  and the policy-enforcing browser proxy. See `api/client/README.md`.
- `api/schemas`: Zod schemas for API vocabulary shared by features, bound to
  the generated types. See `api/schemas/README.md`.
- `navigation`: canonical, framework-independent route construction shared
  across features.
- `observability`: structured application logging. See
  `observability/README.md`.
- `presence`: who is in a cohort's campus and where world last placed them,
  applied from realtime messages. See `presence/README.md`.
- `realtime`: generated world socket protocol types, the parser for inbound
  frames, the close policy and the socket client. See `realtime/README.md`.
- `session`: the cross-feature Campus Access Session refresh contract. See
  `session/README.md`.

Planned concerns are `game` and `media`. Create each concern only when its first
implementation is required.

Core may import from `shared`. It must never import from `features` or `app`.
