import { describe, expect, it } from "vitest";

import { buildRootMetadata, PRIVATE_PAGE_ROBOTS } from "./metadata";

describe("buildRootMetadata", () => {
  it("marks a deployment without a site URL noindex", () => {
    expect(buildRootMetadata(undefined)).toMatchObject({
      metadataBase: undefined,
      robots: PRIVATE_PAGE_ROBOTS,
    });
  });

  it("indexes the public site and resolves share URLs against it", () => {
    const origin = new URL("https://campus.example.test");

    expect(buildRootMetadata(origin)).toMatchObject({
      metadataBase: origin,
      robots: { index: true, follow: true },
    });
  });

  it("never sets a canonical a child page would inherit", () => {
    const metadata = buildRootMetadata(new URL("https://campus.example.test"));

    expect(metadata.alternates?.canonical).toBeUndefined();
    expect(metadata.openGraph?.url).toBeUndefined();
  });
});
