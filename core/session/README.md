# Session

## Interface

`RefreshSession` is the cross-feature contract for renewing the browser's
Campus Access Session. It preserves refreshed, expired, and transient failure
outcomes.

## Modules

- `session-refresh.tsx`: refresh result contract and route-composed context.
- `index.ts`: public API.

## Contributing

Keep HTTP calls in the auth feature. This concern owns only the shared contract.

## Tests

Auth provider and realtime client suites verify every result variant.
