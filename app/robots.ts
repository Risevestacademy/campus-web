import { buildRobots, readSiteOrigin } from "@/core/seo";

export default function robots() {
  return buildRobots(readSiteOrigin());
}
