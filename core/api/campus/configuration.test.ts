// @vitest-environment node

import { describe, expect, it } from "vitest";

import { readCampusApiBaseUrl, readCampusOpenApiUrl } from "./configuration";

describe("readCampusApiBaseUrl", () => {
  it("returns a normalized HTTPS origin", () => {
    expect(
      readCampusApiBaseUrl({
        CAMPUS_API_BASE_URL: " https://api.example.test/ ",
      }),
    ).toBe("https://api.example.test");
  });

  it("accepts a Railway private HTTP origin", () => {
    expect(
      readCampusApiBaseUrl({
        CAMPUS_API_BASE_URL: "http://campus-api.railway.internal:3000",
      }),
    ).toBe("http://campus-api.railway.internal:3000");
  });

  it("rejects a missing server origin", () => {
    expect(() => readCampusApiBaseUrl({ CAMPUS_API_BASE_URL: " " })).toThrow(
      "CAMPUS_API_BASE_URL is required.",
    );
  });

  it("rejects a non-HTTPS server origin", () => {
    expect(() =>
      readCampusApiBaseUrl({
        CAMPUS_API_BASE_URL: "http://api.example.test",
      }),
    ).toThrow(
      "CAMPUS_API_BASE_URL must be an HTTPS origin or a Railway private HTTP origin.",
    );
  });

  it("rejects a server URL containing path or credential information", () => {
    expect(() =>
      readCampusApiBaseUrl({
        CAMPUS_API_BASE_URL: "https://user:secret@api.example.test/v1",
      }),
    ).toThrow(
      "CAMPUS_API_BASE_URL must be an HTTPS origin or a Railway private HTTP origin.",
    );
  });
});

describe("readCampusOpenApiUrl", () => {
  it("derives the schema URL from the configured backend origin", () => {
    expect(
      readCampusOpenApiUrl({
        CAMPUS_API_BASE_URL: "https://api.example.test",
      }),
    ).toBe("https://api.example.test/docs-json");
  });
});
