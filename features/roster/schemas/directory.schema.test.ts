import { describe, expect, it } from "vitest";

import { parseCohortDirectory } from "./directory.schema";

describe("parseCohortDirectory", () => {
  it("keeps the id and name of each person and drops the rest", () => {
    expect(
      parseCohortDirectory([
        { id: "a", displayName: "Ada", spriteKey: "placeholder-1", email: "x" },
        { id: "b", displayName: null, spriteKey: null },
      ]),
    ).toEqual([
      { id: "a", displayName: "Ada" },
      { id: "b", displayName: null },
    ]);
  });

  it.each([
    ["not a list", { id: "a", displayName: "Ada" }],
    ["a row without an id", [{ displayName: "Ada" }]],
    ["a row with an empty id", [{ id: "", displayName: "Ada" }]],
    ["a row without a name field", [{ id: "a" }]],
  ])("reads %s as nothing", (_, body) => {
    expect(parseCohortDirectory(body)).toBeUndefined();
  });
});
