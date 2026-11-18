import { describe, expect, it } from "vitest";

import { parseRetryAfterMs } from "./retry-after";

const NOW = Date.parse("2026-10-02T12:00:00.000Z");

describe("parseRetryAfterMs", () => {
  it.each([
    ["delay seconds", "3", 3000],
    ["zero seconds", "0", 0],
    ["padded delay seconds", " 1 ", 1000],
    ["an HTTP date", "Fri, 02 Oct 2026 12:00:05 GMT", 5000],
    ["an HTTP date in the past", "Fri, 02 Oct 2026 11:59:00 GMT", 0],
  ])("reads %s", (_, header, expected) => {
    expect(parseRetryAfterMs(header, NOW)).toBe(expected);
  });

  it.each([
    ["a missing header", null],
    ["an empty header", ""],
    ["garbage", "soon"],
  ])("ignores %s", (_, header) => {
    expect(parseRetryAfterMs(header, NOW)).toBeUndefined();
  });
});
