# Shared

Domain-independent code reused by at least two features belongs here.

Shared code must not understand Campus business concepts and must not import
from `core`, `features`, or `app`. Keep single-feature code colocated until reuse
is established.
