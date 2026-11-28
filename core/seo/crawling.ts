import type { MetadataRoute } from "next";

// Private routes stay crawlable on purpose: a crawler has to fetch a page to
// read its noindex. Only the API proxy, which renders nothing, is blocked.
export function buildRobots(origin: URL | undefined): MetadataRoute.Robots {
  if (!origin) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: new URL("/sitemap.xml", origin).href,
  };
}

export function buildSitemap(origin: URL | undefined): MetadataRoute.Sitemap {
  return origin ? [{ url: origin.href, changeFrequency: "monthly" }] : [];
}
