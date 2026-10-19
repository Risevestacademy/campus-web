// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parseSocketClose } from "./socket-close.schema";

describe("parseSocketClose", () => {
  it("keeps a close inside the registered range", () => {
    expect(parseSocketClose(4000, "entered_elsewhere")).toEqual({
      code: 4000,
      reason: "entered_elsewhere",
    });
  });

  it.each([
    ["a code too small", 999],
    ["a code too large", 5000],
    ["a fractional code", 4000.5],
    ["no code", undefined],
    ["hostile input", { toString: true }],
  ])("replaces %s with an unclassifiable close", (_case, code) => {
    expect(parseSocketClose(code, "x")).toEqual({ code: 0, reason: "x" });
  });

  it("keeps the code when the reason is unusable alone", () => {
    expect(parseSocketClose(4000, "x".repeat(124))).toEqual({
      code: 4000,
      reason: "",
    });
  });

  it("bounds a close reason by UTF-8 bytes rather than characters", () => {
    expect(parseSocketClose(4000, "🙂".repeat(30))).toEqual({
      code: 4000,
      reason: "🙂".repeat(30),
    });
    expect(parseSocketClose(4000, "🙂".repeat(31))).toEqual({
      code: 4000,
      reason: "",
    });
  });
});
