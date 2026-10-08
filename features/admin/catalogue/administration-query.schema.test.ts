import { describe, expect, it } from "vitest";

import { parseAdministrationQuery } from "./administration-query.schema";

describe("parseAdministrationQuery", () => {
  it.each([
    [undefined, undefined, { view: "cohorts", page: 1 }],
    ["cohorts", "2", { view: "cohorts", page: 2 }],
    ["tracks", "3", { view: "tracks", page: 3 }],
  ])("accepts %j/%j", (view, page, expected) => {
    expect(parseAdministrationQuery(view, page)).toEqual(expected);
  });

  it.each([
    ["unknown", "2"],
    ["tracks", "0"],
    ["tracks", "abc"],
    ["cohorts", "1.5"],
  ])("falls back to Cohorts page 1 for invalid %j/%j", (view, page) => {
    expect(parseAdministrationQuery(view, page)).toEqual({
      view: "cohorts",
      page: 1,
    });
  });
});
