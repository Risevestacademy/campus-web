import { describe, expect, it } from "vitest";

import { parseCohortPeople } from "./people.schema";

describe("parseCohortPeople", () => {
  it("keeps the id and name and drops the rest", () => {
    expect(
      parseCohortPeople([
        {
          id: "11111111-1111-4111-8111-111111111111",
          displayName: "Ada L.",
          spriteKey: "placeholder-1",
          x: 1,
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          displayName: null,
          spriteKey: null,
        },
      ]),
    ).toStrictEqual([
      { id: "11111111-1111-4111-8111-111111111111", displayName: "Ada L." },
      { id: "22222222-2222-4222-8222-222222222222", displayName: null },
    ]);
  });

  it.each([
    null,
    "text",
    {},
    [{}],
    [{ id: "", displayName: "Ada" }],
    [{ id: 7, displayName: "Ada" }],
    [{ id: "11111111-1111-4111-8111-111111111111", displayName: 7 }],
    [{ id: "11111111-1111-4111-8111-111111111111" }],
    [{ id: "11111111-1111-4111-8111-111111111111", displayName: "Ada" }, null],
    [{ id: "p-1", displayName: "Ada" }],
    [{ id: "../../etc", displayName: "Ada" }],
  ])("finds no people in %j", (body) => {
    expect(parseCohortPeople(body)).toBeUndefined();
  });
});
