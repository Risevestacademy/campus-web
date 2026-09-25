# Home

The home domain owns the public landing page rendered at `/`.

## Structure

```text
features/home/
├── index.ts
├── README.md
└── sections/
    └── hero/
        └── hero-section.tsx
```

`sections/hero/` is the reference implementation for future landing-page
sections.

## Section contract

Each landing-page section:

- lives in its own `sections/<name>/` directory;
- uses `<name>-section.tsx` as its entry component;
- uses a named `<Name>Section` export;
- remains a Server Component unless a focused interactive leaf requires
  `"use client"`;
- renders a semantic section with a stable `id` and accessible heading;
- colocates its components, assets, styles, and helpers in its directory;
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
