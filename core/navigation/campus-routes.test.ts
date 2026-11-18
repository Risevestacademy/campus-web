import type { Route } from "next";
import { describe, expect, expectTypeOf, it } from "vitest";

import { campusHref, campusJoinHref, campusPreJoinHref } from "./campus-routes";

describe("Campus routes", () => {
  it("returns typed routes so callers never cast", () => {
    expectTypeOf(campusHref).returns.toEqualTypeOf<Route>();
    expectTypeOf(campusJoinHref).returns.toEqualTypeOf<Route>();
    expectTypeOf(campusPreJoinHref).returns.toEqualTypeOf<Route>();
  });

  it.each([
    [
      "an ordinary cohort ID",
      "cohort-1",
      "/campus/cohort-1",
      "/campus/cohort-1/join",
    ],
    [
      "an ID containing reserved path characters",
      "a/b c",
      "/campus/a%2Fb%20c",
      "/campus/a%2Fb%20c/join",
    ],
  ])("keeps %s inside one path segment", (_, cohortId, campus, join) => {
    expect(campusHref(cohortId)).toBe(campus);
    expect(campusJoinHref(cohortId)).toBe(join);
  });

  it("sends an unmarked deep link through its cohort pre-join route", () => {
    expect(
      campusPreJoinHref(
        "c-1",
        "/campus/c-1/meeting?tab=people&prejoin=complete",
      ),
    ).toBe(
      "/campus/c-1/join?returnTo=%2Fcampus%2Fc-1%2Fmeeting%3Ftab%3Dpeople",
    );
  });
});
