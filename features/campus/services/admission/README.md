# Campus admission

Owns the in-memory workflow state proving that the current browser document
completed Join for one cohort. It is not an authorization credential.

## Interface

- `CampusAdmissionProvider` uses one browser-module store for the document.
  Server renders receive isolated stores, so state cannot cross requests.
- Join grants one exact pending destination before client navigation.
- Active Campus completes only an exact grant, then remembers the admitted
  cohort for later client navigation in the same document.

## Modules

| Module                          | Owns                                      |
| ------------------------------- | ----------------------------------------- |
| `campus-admission-store.ts`     | Pending destination and admitted cohort   |
| `campus-admission-provider.tsx` | React context and subscribed selector API |

## Contributing

- Keep admission separate from authorization and media-device state.
- Do not persist it in cookies, storage, or the URL.
- A new document, tab, or hard reload must start without admission.

## Tests

Admission behavior is covered through `CampusAdmissionProvider`,
`ActiveCampusAdmissionGate`, `CampusJoinButton`, and the authorization
Playwright flow.
