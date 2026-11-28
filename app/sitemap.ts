import { buildSitemap, readSiteOrigin } from "@/core/seo";

export default function sitemap() {
  return buildSitemap(readSiteOrigin());
}
