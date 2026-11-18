// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  allowedTypesOf,
  maxBytesOf,
  parseSignedUpload,
  parseUploadLimits,
} from "./upload.schema";

const avatar = {
  kind: "avatar",
  contentTypes: ["image/jpeg", "image/webp"],
  maxBytes: 2_000_000,
};

describe("parseUploadLimits", () => {
  it("keeps each known kind's types and size, and nothing else", () => {
    expect(
      parseUploadLimits({ kinds: [avatar], maxAttachments: 10 }),
    ).toStrictEqual([avatar]);
  });

  it("skips a kind this client does not know yet", () => {
    expect(
      parseUploadLimits({
        kinds: [{ kind: "something_new", maxBytes: "lots" }, avatar],
      }),
    ).toStrictEqual([avatar]);
  });

  it("refuses a known kind whose limits it cannot read", () => {
    expect(
      parseUploadLimits({ kinds: [{ ...avatar, maxBytes: "2MB" }] }),
    ).toBeUndefined();
  });
});

describe("parseSignedUpload", () => {
  const signed = {
    mediaId: "m-1",
    uploadUrl: "https://storage.example/put",
    headers: { "Content-Type": "image/webp" },
  };

  it("keeps the media id, the https address and the headers", () => {
    expect(
      parseSignedUpload({
        ...signed,
        method: "PUT",
        expiresAt: "2026-11-16T12:00:00.000Z",
      }),
    ).toStrictEqual(signed);
  });

  it("refuses an address that is not https", () => {
    expect(
      parseSignedUpload({ ...signed, uploadUrl: "http://storage.example/put" }),
    ).toBeUndefined();
  });
});

describe("the 413 and 415 details", () => {
  it("reads them under their own codes only", () => {
    const details = { maxBytes: 1, allowed: ["image/png"] };

    expect(maxBytesOf({ error: { code: "UPLOAD_TOO_LARGE", details } })).toBe(
      1,
    );
    expect(
      allowedTypesOf({ error: { code: "UPLOAD_TYPE_NOT_ALLOWED", details } }),
    ).toStrictEqual(["image/png"]);
    expect(
      maxBytesOf({ error: { code: "UPLOAD_TYPE_NOT_ALLOWED", details } }),
    ).toBeUndefined();
    expect(
      allowedTypesOf({ error: { code: "UPLOAD_TOO_LARGE", details } }),
    ).toBeUndefined();
  });
});
