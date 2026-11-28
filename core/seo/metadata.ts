import type { Metadata } from "next";

import { SITE_DESCRIPTION, SITE_NAME } from "./site";

export const PRIVATE_PAGE_ROBOTS = {
  index: false,
  follow: false,
} satisfies Metadata["robots"];

// No canonical or og:url here: children inherit them, and every page would
// then claim to be the home page.
export function buildRootMetadata(origin: URL | undefined): Metadata {
  return {
    metadataBase: origin,
    title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        // Google shows a search favicon only at 48px or larger.
        {
          url: "/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
      ],
      apple: "/apple-touch-icon.png",
    },
    manifest: "/site.webmanifest",
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
    },
    robots: origin ? { index: true, follow: true } : PRIVATE_PAGE_ROBOTS,
  };
}
