import { describe, expect, it } from "vitest";

import { withoutUndefined } from "./without-undefined";

describe("withoutUndefined", () => {
  it("drops keys whose value is undefined", () => {
    expect(withoutUndefined({ name: "Ada", note: undefined })).toStrictEqual({
      name: "Ada",
    });
  });

  it("keeps null, empty, and falsy values", () => {
    expect(
      withoutUndefined({ endDate: null, note: "", count: 0, open: false }),
    ).toStrictEqual({ endDate: null, note: "", count: 0, open: false });
  });
});
