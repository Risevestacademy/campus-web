# Shared

Domain-independent code reused by at least two features belongs here.

Shared code must not understand Campus business concepts and must not import
from `core`, `features`, or `app`. Keep single-feature code colocated until reuse
is established.

Generated visual primitives belong in flat `shared/ui/*.tsx` files so shadcn
can add and update them without manual relocation. Colocate stories and tests
by basename. Application-owned composite components may use directories when
they contain multiple implementation files. Stories document only real
component states and variants.

Shared UI may consume approved semantic design tokens. It must not import from
`design-system`; that directory documents shared UI rather than owning it.

## Validation helpers

The rules behind these live in "Validation and Data Privacy" in
`docs/architectural-plan.md`. Use a helper before writing a new one.

| Helper                     | Use it for                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `lib/parse-json.ts`        | `parseJson(schema, text)`: stored or received JSON, `undefined` when invalid          |
| `lib/search-params.ts`     | `parsePageNumber` and `firstSearchParameter`, parsed once at a page's entry           |
| `lib/forms/`               | `parseForm(schema, form)`: typed data or field errors ([README](lib/forms/README.md)) |
| `lib/without-undefined.ts` | create bodies: drop keys read as absent                                               |
| `lib/changed-fields.ts`    | update bodies: send only the fields that changed                                      |
