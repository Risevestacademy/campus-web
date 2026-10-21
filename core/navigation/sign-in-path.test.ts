import { describe, expect, it } from "vitest";

import { SIGN_IN_PATH } from "./sign-in-path";

describe("SIGN_IN_PATH", () => {
  it("is the sign-in page", () => {
    expect(SIGN_IN_PATH).toBe("/sign-in");
  });
});
