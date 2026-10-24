# Home

Owns the public landing page rendered at `/`. Sign-in and Campus belong to
`auth` and `campus`.

## Interface

`index.ts` exports one `<Name>Section` per section; `app/page.tsx` composes
them in order. Consumers never deep-import `sections/`.

## Modules

| Module                | Owns                                       | Seam |
| --------------------- | ------------------------------------------ | ---- |
| `sections/<name>.tsx` | one landing-page section                   | none |
| `sections/hero/`      | the hero and its mobile menu (client leaf) | none |

A section is one file until it has a client leaf, a test, or several files;
then it moves to `sections/<name>/` with `<name>-section.tsx` as its entry.

## Contributing

### Adding a section

1. Create `sections/<name>.tsx` with a named `<Name>Section` export.
2. Render a semantic `<section>` with a stable `id` and an accessible heading.
3. Leave the export and the `app/page.tsx` placement to the landing-page
   integrator after branches merge, so those two files never conflict.

### Rules

- Sections stay Server Components unless a focused interactive leaf needs
  `"use client"`.
- Own only your section: never edit or import another section.
- Import from `core` and `shared` only, never another feature.
- Keep one-caller helpers private to the section's file or folder.
- Comment only a non-obvious why.

## Tests

```bash
pnpm vitest run --project=unit features/home
```

Static markup needs no test. Add one when a section gains behaviour,
branching, data transformation, or interaction.
