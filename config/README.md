# Configuration

Repository-level configuration and deterministic build validation belong here.

- `architecture-boundaries.json` defines allowed dependency directions.
- `environment/public.ts` is the only browser-safe environment access layer.
- `environment/build.ts` assembles values used during CI and Vercel builds.
- `environment/validation.ts` validates protected builds.

Add future public variables to `environment/public.ts` and build checks to
`environment/validation.ts`. Server secrets must use a separate server-only
environment module and must never enter the public environment object.

Local analytics configuration remains optional so analytics can be disabled
during local development.
