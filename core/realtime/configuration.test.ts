// @vitest-environment node

import { describe, expect, it } from "vitest";

import { readWorldOrigin, readWorldSchemaUrl } from "./configuration";

const INVALID_ORIGIN_MESSAGE =
  "NEXT_PUBLIC_WORLD_URL must be an HTTPS or loopback HTTP origin.";

describe("readWorldOrigin", () => {
  it("returns a normalized HTTPS origin", () => {
    expect(
      readWorldOrigin({
        NEXT_PUBLIC_WORLD_URL: " https://ws.example.test/ ",
      }),
    ).toBe("https://ws.example.test");
  });

  it.each([
    "http://localhost:8001",
    "http://127.0.0.1:8001",
    "http://[::1]:8001",
  ])("accepts the loopback HTTP origin %s", (origin) => {
    expect(readWorldOrigin({ NEXT_PUBLIC_WORLD_URL: origin })).toBe(
      new URL(origin).origin,
    );
  });

  it("rejects a missing world origin", () => {
    expect(() => readWorldOrigin({ NEXT_PUBLIC_WORLD_URL: " " })).toThrow(
      "NEXT_PUBLIC_WORLD_URL is required.",
    );
  });

  it.each([
    ["plain HTTP on a public host", "http://ws.example.test"],
    [
      "a Railway private host the browser cannot reach",
      "http://world.railway.internal:8001",
    ],
    ["a WebSocket scheme instead of the HTTP origin", "wss://ws.example.test"],
    ["credentials", "https://user:secret@ws.example.test"],
    ["a path", "https://ws.example.test/socket"],
    ["a query", "https://ws.example.test/?cohortId=1"],
    ["text that is not a URL", "ws.example.test"],
  ])("rejects %s", (_case, value) => {
    expect(() => readWorldOrigin({ NEXT_PUBLIC_WORLD_URL: value })).toThrow(
      INVALID_ORIGIN_MESSAGE,
    );
  });
});

describe("readWorldSchemaUrl", () => {
  it("derives the protocol schema URL from the world origin", () => {
    expect(
      readWorldSchemaUrl({
        NEXT_PUBLIC_WORLD_URL: "https://ws.example.test",
      }),
    ).toBe("https://ws.example.test/schema.json");
  });
});
