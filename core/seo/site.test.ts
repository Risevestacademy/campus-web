import { describe, expect, it } from "vitest";

import { parseSiteOrigin } from "./site";

describe("parseSiteOrigin", () => {
  it.each([undefined, "", "   "])(
    "treats %j as a deployment that is not the public site",
    (siteUrl) => {
      expect(
        parseSiteOrigin({ NEXT_PUBLIC_SITE_URL: siteUrl }),
      ).toBeUndefined();
    },
  );

  it.each([
    ["a public HTTPS site", "https://campus.example.test"],
    ["a trailing slash", "https://campus.example.test/"],
    ["a local production build", "http://localhost:3000"],
  ])("accepts %s", (_case, siteUrl) => {
    expect(parseSiteOrigin({ NEXT_PUBLIC_SITE_URL: siteUrl })?.href).toBe(
      new URL(siteUrl).href,
    );
  });

  // Railway builds skip build validation, so a typo must still fail loudly
  // instead of quietly deindexing production.
  it.each([
    ["plain HTTP on a public host", "http://campus.example.test"],
    ["a Railway private host", "https://web.railway.internal"],
    ["a path", "https://campus.example.test/home"],
    ["no scheme", "campus.example.test"],
  ])("rejects %s", (_case, siteUrl) => {
    expect(() => parseSiteOrigin({ NEXT_PUBLIC_SITE_URL: siteUrl })).toThrow(
      "NEXT_PUBLIC_SITE_URL must be a public HTTPS or loopback HTTP origin.",
    );
  });
});
