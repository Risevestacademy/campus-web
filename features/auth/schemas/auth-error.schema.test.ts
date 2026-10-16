import { describe, expect, it } from "vitest";

import { authErrorMessage } from "./auth-error.schema";

const UNKNOWN = "Sign-in could not be completed. Please try again.";

describe("authErrorMessage", () => {
  it("explains a known OAuth error code", () => {
    expect(authErrorMessage("invite_required")).toBe(
      "You need an invitation to access Campus.",
    );
  });

  it.each(["__proto__", "constructor", "toString", "hasOwnProperty"])(
    "gives the generic message for the prototype key %s",
    (code) => {
      expect(authErrorMessage(code)).toBe(UNKNOWN);
    },
  );

  it("never echoes an unknown code", () => {
    expect(authErrorMessage("private-backend-detail")).toBe(UNKNOWN);
  });

  it.each([undefined, ""])("shows nothing for %j", (code) => {
    expect(authErrorMessage(code)).toBeUndefined();
  });
});
