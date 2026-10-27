import { describe, expect, it } from "vitest";

import { parseCohortPeople } from "./people.schema";

describe("parseCohortPeople", () => {
  it("keeps the id and name and drops the rest", () => {
    expect(
      parseCohortPeople([
        { id: "p-1", displayName: "Ada L.", spriteKey: "placeholder-1", x: 1 },
        { id: "p-2", displayName: null, spriteKey: null },
      ]),
    ).toStrictEqual([
      { id: "p-1", displayName: "Ada L." },
      { id: "p-2", displayName: null },
    ]);
  });

  it.each([
    null,
    "text",
    {},
    [{}],
    [{ id: "", displayName: "Ada" }],
    [{ id: 7, displayName: "Ada" }],
    [{ id: "p-1", displayName: 7 }],
    [{ id: "p-1" }],
    [{ id: "p-1", displayName: "Ada" }, null],
  ])("finds no people in %j", (body) => {
    expect(parseCohortPeople(body)).toBeUndefined();
  });
});
