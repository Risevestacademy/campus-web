import { describe, expect, it } from "vitest";

import { buildRobots, buildSitemap } from "./crawling";

const PRODUCTION = new URL("https://campus.example.test");

describe("buildRobots", () => {
  it("keeps every crawler out of a deployment without a site URL", () => {
    expect(buildRobots(undefined)).toEqual({
      rules: { userAgent: "*", disallow: "/" },
    });
  });

  it("opens the public site, blocks the API proxy, and points at the sitemap", () => {
    expect(buildRobots(PRODUCTION)).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: "/api/" },
      sitemap: "https://campus.example.test/sitemap.xml",
    });
  });
});

describe("buildSitemap", () => {
  it("lists nothing without a site URL", () => {
    expect(buildSitemap(undefined)).toEqual([]);
  });

  it("lists only the landing page, as an absolute URL", () => {
    expect(buildSitemap(PRODUCTION).map(({ url }) => url)).toEqual([
      "https://campus.example.test/",
    ]);
  });
});
