import { describe, expect, it } from "vitest";

import { wholeMegabytes } from "./whole-megabytes";

describe("wholeMegabytes", () => {
  it.each([
    [26_214_400, "25 MB"],
    [5_242_880, "5 MB"],
    [2_000_000, "2 MB"],
    [5_500_000, "5 MB"],
    [500, "1 MB"],
  ])("reads %i as %s", (bytes, label) => {
    expect(wholeMegabytes(bytes)).toBe(label);
  });
});
