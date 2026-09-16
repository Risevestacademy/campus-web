// @vitest-environment node

import { describe, expect, it } from "vitest";

import { readApiBaseUrl, readOpenApiUrl } from "./configuration";

describe("readApiBaseUrl", () => {
  it("returns a normalized HTTPS origin", () => {
    expect(
      readApiBaseUrl({
        API_BASE_URL: " https://api.example.test/ ",
      }),
    ).toBe("https://api.example.test");
  });

  it("accepts a Railway private HTTP origin", () => {
    expect(
      readApiBaseUrl({
        API_BASE_URL: "http://campus-api.railway.internal:3000",
      }),
    ).toBe("http://campus-api.railway.internal:3000");
  });

  it("rejects a missing server origin", () => {
    expect(() => readApiBaseUrl({ API_BASE_URL: " " })).toThrow(
      "API_BASE_URL is required.",
    );
  });

  it("rejects a non-HTTPS server origin", () => {
    expect(() =>
      readApiBaseUrl({
        API_BASE_URL: "http://api.example.test",
      }),
    ).toThrow(
      "API_BASE_URL must be an HTTPS origin or a Railway private HTTP origin.",
    );
  });

  it("rejects a server URL containing path or credential information", () => {
    expect(() =>
      readApiBaseUrl({
        API_BASE_URL: "https://user:secret@api.example.test/v1",
      }),
    ).toThrow(
      "API_BASE_URL must be an HTTPS origin or a Railway private HTTP origin.",
    );
  });
});

describe("readOpenApiUrl", () => {
  it("derives the schema URL from the configured backend origin", () => {
    expect(
      readOpenApiUrl({
        API_BASE_URL: "https://api.example.test",
      }),
    ).toBe("https://api.example.test/docs-json");
  });
});
