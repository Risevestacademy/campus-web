// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parsePersonId } from "./person-id.schema";

const ID = "3f0c2d1a-6b6e-4c4b-8f55-0c9d1e5a7b21";

describe("person ID parser", () => {
  it("passes an account id through", () => {
    expect(parsePersonId(ID)).toBe(ID);
  });

  it.each(["", "person", "../x", `${ID}/profile`, `${ID}?x=1`, 42, undefined])(
    "refuses %j",
    (value) => {
      expect(parsePersonId(value)).toBeUndefined();
    },
  );
});
