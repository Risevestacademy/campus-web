# Design System

Central Storybook documentation for Campus design foundations belongs here.

This directory documents production design decisions; it does not redefine
tokens or contain reusable application components.

- Reusable domain-independent UI belongs in `shared/ui/`.
- Feature-aware components and their stories remain inside their feature.
- Stories normally live beside the component they document.
- Foundation documentation may import from `shared`.
- Application and feature code must not import from `design-system`.

Colors, typography, spacing, radius, shadows, icons, and motion will be added
only when their approved design source is available.

See [Adding a story](../README.md#adding-a-story) for component placement,
authoring conventions, testing, and verification.
