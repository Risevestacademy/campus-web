# SEO

## Interface

`index.ts` exports what the `app/` metadata files wire up:

- `readSiteOrigin()`: the public origin from `NEXT_PUBLIC_SITE_URL`, or
  `undefined` when the deployment is not the public site.
- `buildRootMetadata(origin)`: the root layout's metadata, with a title
  template, icons, the manifest, Open Graph, the Twitter card, and the index
  switch.
- `PRIVATE_PAGE_ROBOTS`: the `robots` value for every route behind sign-in or
  an invite.
- `buildRobots(origin)`, `buildSitemap(origin)`: `/robots.txt` and
  `/sitemap.xml`.
- `JsonLd`: a structured-data script that content cannot break out of.

## Indexing rule

Only the production service sets `NEXT_PUBLIC_SITE_URL`. With it, the landing
page is indexed, the sitemap lists it, and share URLs are absolute. Without it,
`robots.txt` disallows everything and every page is `noindex`. Private routes
are `noindex` on production too, and stay crawlable so crawlers can read that.

## Modules

| Module        | Owns                                       |
| ------------- | ------------------------------------------ |
| `site.ts`     | site name, description, and origin parsing |
| `metadata.ts` | root metadata and the private-page robots  |
| `crawling.ts` | `robots.txt` and sitemap entries           |
| `json-ld.tsx` | escaping structured data into a script tag |

The icons and `site.webmanifest` are the favicon.io pack in `public/`,
declared by `buildRootMetadata`. They sit at the root because browsers and
crawlers request `/favicon.ico` there. The share image is
`app/opengraph-image.tsx`.

## Contributing

- A new public page adds itself to `buildSitemap` and sets its own
  `alternates.canonical`. A new private route group sets
  `robots: PRIVATE_PAGE_ROBOTS` in its layout.
- Page-specific structured data belongs to the feature that owns the page,
  rendered through `JsonLd`.

## Tests

```bash
pnpm vitest run --project=unit core/seo
```
