import { describe, expect, it } from "vitest";

import {
  cohortRoleSchema,
  parseExceptionCode,
  sessionScopeSchema,
  systemRoleSchema,
} from "./index";

describe("API enum schemas", () => {
  it.each([
    [sessionScopeSchema, ["provisional", "full_access"]],
    [systemRoleSchema, ["user", "admin", "super_admin"]],
    [cohortRoleSchema, ["student", "professor", "mentor", "guest"]],
  ] as const)("accepts exactly the generated values", (schema, values) => {
    expect(schema.options).toEqual(values);
  });

  it.each(["", "root", "__proto__", "STUDENT"])("rejects %j", (value) => {
    expect(cohortRoleSchema.safeParse(value).success).toBe(false);
  });
});

describe("parseExceptionCode", () => {
  it("reads the code from an API error body", () => {
    expect(
      parseExceptionCode({ error: { code: "INVITE_REVOKED", message: "x" } }),
    ).toBe("INVITE_REVOKED");
  });

  it.each([
    ["an unknown code", { error: { code: "TEAPOT" } }],
    ["a prototype key", { error: { code: "constructor" } }],
    ["a missing envelope", { code: "CONFLICT" }],
    ["no body", undefined],
  ])("returns undefined for %s", (_, body) => {
    expect(parseExceptionCode(body)).toBeUndefined();
  });
});
