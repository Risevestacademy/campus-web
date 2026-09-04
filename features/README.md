# Features

Business behavior is organized by product domain.

Planned domains:

- auth
- campus-session
- campus-world
- avatar
- presence
- proximity
- communication
- classroom
- desk
- notice-wall
- resource-centre
- stage
- profile

Create a feature directory only when implementation starts. Colocate its
components, hooks, services, schemas, state, types, and tests. Expose consumers
through `index.ts`; do not deep-import another feature or import feature-to-feature.
