# Home

The home domain owns the public landing page rendered at `/`.

## Structure

```text
features/home/
├── index.ts
├── README.md
└── sections/
    ├── cta.tsx           # a section is one file…
    ├── faqs.tsx
    └── hero/             # …until it needs a folder
        ├── hero-section.tsx
        ├── hero-mobile-menu.tsx
        └── hero-mobile-menu.test.tsx
```

## Section contract

Each landing-page section:

- is one file, `sections/<name>.tsx`, with a named `<Name>Section` export;
- moves to `sections/<name>/`, with `<name>-section.tsx` as its entry, only
  once it has a client leaf, a test, or several files;
- remains a Server Component unless a focused interactive leaf requires
  `"use client"`;
- renders a semantic section with a stable `id` and accessible heading;
- keeps one-caller helpers as private functions in its own file or folder;
- may import from `core` and `shared`, but never from another feature; and
- must not import another home section directly.

Consumers import home-domain exports through `@/features/home`. They must not
deep-import files under `sections/`.

## Parallel contribution

Each contributor owns their new section and its supporting files. Contributors
must not edit another section.

After parallel branches merge, one designated landing-page integrator:

1. exports completed sections from `features/home/index.ts`; and
2. composes them in order in `app/page.tsx`.

Serializing these small integration edits prevents the public entrypoint and
route from becoming shared merge-conflict hotspots.

Static sections do not need Vitest coverage solely for their markup. Add tests
when a section introduces behavior, branching, data transformation, or user
interaction.
