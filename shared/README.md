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
