# Motion

The motion module owns the member's reduced-motion preference.

- `motion.ts` contains the stored-value parser and the pre-hydration
  initializer.
- `motion-store.ts` synchronizes the document, local storage, and browser tabs.
- A member who chose to reduce motion has `data-motion="reduce"` on `<html>`.
  Without that choice, the operating-system setting applies.
- `globals.css` redefines Tailwind's `motion-reduce:` and `motion-safe:`
  variants so they honour the attribute as well as the media query.
- `MotionPreferenceConfig` sets Motion's `MotionConfig`, so Motion components
  and `useReducedMotionConfig` follow the same choice. Read reduced motion with
  `useReducedMotionConfig`, not `useReducedMotion`, which sees only the
  operating system.
- CSS that cannot use the Tailwind variants pairs
  `@media (prefers-reduced-motion: reduce)` with a
  `:root[data-motion="reduce"]` rule.

The hook and `MotionPreferenceConfig` load only in client modules, so
`index.ts` does not export them.
