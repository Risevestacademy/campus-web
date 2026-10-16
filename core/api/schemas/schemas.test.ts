import { describe, expect, it } from "vitest";

import {
  cohortRoleSchema,
  cohortStatusSchema,
  paginationMetaSchema,
  parseExceptionCode,
  sessionScopeSchema,
  systemRoleSchema,
} from "./index";

describe("API enum schemas", () => {
  it.each([
    [sessionScopeSchema, ["provisional", "full_access"]],
    [systemRoleSchema, ["user", "admin", "super_admin"]],
    [cohortRoleSchema, ["student", "professor", "mentor", "guest"]],
    [cohortStatusSchema, ["upcoming", "active", "completed"]],
  ] as const)("accepts exactly the generated values", (schema, values) => {
    expect(schema.options).toEqual(values);
  });

  it.each(["", "root", "__proto__", "STUDENT"])("rejects %j", (value) => {
    expect(cohortRoleSchema.safeParse(value).success).toBe(false);
  });
});

describe("paginationMetaSchema", () => {
  it("keeps only the page fields list screens read", () => {
    expect(
      paginationMetaSchema.parse({
        page: 2,
        perPage: 20,
        total: 152,
        totalPages: 8,
      }),
    ).toStrictEqual({ page: 2, totalPages: 8 });
  });

  it("accepts an empty list", () => {
    expect(
      paginationMetaSchema.safeParse({ page: 1, totalPages: 0 }).success,
    ).toBe(true);
  });

  it.each([
    ["page 0", { page: 0, totalPages: 1 }],
    ["a fractional page", { page: 1.5, totalPages: 2 }],
    ["negative totalPages", { page: 1, totalPages: -1 }],
    ["a string page", { page: "1", totalPages: 1 }],
    ["missing totalPages", { page: 1 }],
  ])("rejects %s", (_, meta) => {
    expect(paginationMetaSchema.safeParse(meta).success).toBe(false);
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
