# Shared

Domain-independent code reused by at least two features belongs here.

Shared code must not understand Campus business concepts and must not import
from `core`, `features`, or `app`. Keep single-feature code colocated until reuse
is established.

Reusable visual primitives belong in `shared/ui/<component>/`. Keep each
component, story, test, local types, and local helpers colocated. Stories
document only real component states and variants.

Shared UI may consume approved semantic design tokens. It must not import from
`design-system`; that directory documents shared UI rather than owning it.
