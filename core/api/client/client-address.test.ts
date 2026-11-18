import { describe, expect, it } from "vitest";

import { readClientAddress } from "./client-address";

describe("readClientAddress", () => {
  it.each([
    ["an IPv4 address", "203.0.113.10", "203.0.113.10"],
    ["an IPv6 address", "2001:db8::1", "2001:db8::1"],
    ["surrounding spaces", "  203.0.113.10 ", "203.0.113.10"],
  ])("reads %s from the edge header", (_case, value, expected) => {
    expect(readClientAddress(new Headers({ "x-real-ip": value }))).toBe(
      expected,
    );
  });

  it.each([
    ["an empty value", ""],
    ["a list", "203.0.113.10, 198.51.100.7"],
    ["text that is not an address", "unknown"],
  ])("ignores %s", (_case, value) => {
    expect(
      readClientAddress(new Headers({ "x-real-ip": value })),
    ).toBeUndefined();
  });

  it("ignores a missing edge header", () => {
    expect(readClientAddress(new Headers())).toBeUndefined();
  });

  it("never reads a client-sent X-Forwarded-For", () => {
    expect(
      readClientAddress(new Headers({ "x-forwarded-for": "198.51.100.66" })),
    ).toBeUndefined();
  });
});
