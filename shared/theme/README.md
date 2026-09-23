# Theme

The theme module owns the light/dark preference contract.

- `theme.ts` contains the pure resolver and pre-hydration initializer.
- `theme-store.ts` synchronizes the document, local storage, and browser tabs.
- The active theme is represented by `data-theme` on `<html>`.
- When no preference is stored, the operating-system preference is used.
- Supported browsers crossfade theme changes through the View Transition API.
- Browsers without View Transition support switch themes immediately.

UI components consume this contract through the public theme store. The module
does not contain application or Campus domain behavior.
