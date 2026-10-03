import { describe, expect, it, vi } from "vitest";

import {
  normalizeCampusReturnTo,
  normalizeCohortReturnTo,
  parseCampusReturnTo,
} from "../index";

vi.mock("server-only", () => ({}));

describe("parseCampusReturnTo", () => {
  it.each([
    ["the campus index", "/campus", "/campus"],
    ["a trailing slash", "/campus/", "/campus/"],
    ["a nested campus path", "/campus/42/join", "/campus/42/join"],
    [
      "a deep link with a query",
      "/campus/42/rooms/stage?view=grid&seat=3",
      "/campus/42/rooms/stage?view=grid&seat=3",
    ],
    ["an index query", "/campus?page=2", "/campus?page=2"],
    [
      "an encoded identifier",
      "/campus/cohort%20three",
      "/campus/cohort%20three",
    ],
  ])("accepts %s", (_, value, expected) => {
    expect(parseCampusReturnTo(value)).toBe(expected);
  });

  it.each([
    [
      "non-ASCII path and query",
      "/campus/café?q=é",
      "/campus/caf%C3%A9?q=%C3%A9",
    ],
    ["spaces", "/campus/room one?q=a b", "/campus/room%20one?q=a%20b"],
  ])(
    "percent-encodes %s so it is safe in a Location header",
    (_, value, expected) => {
      expect(parseCampusReturnTo(value)).toBe(expected);
    },
  );

  it.each([
    ["a fragment", "/campus/42#notes", "/campus/42"],
    [
      "a fragment after a query",
      "/campus/42?tab=people#row",
      "/campus/42?tab=people",
    ],
  ])("discards %s", (_, value, expected) => {
    expect(parseCampusReturnTo(value)).toBe(expected);
  });

  it.each([
    ["an undefined value", undefined],
    ["an empty value", ""],
    ["a relative path", "campus/42"],
    ["a non-campus path", "/invitation"],
    ["a campus prefix lookalike", "/campusfake/42"],
    ["an absolute URL", "https://attacker.example/campus"],
    ["a protocol-relative URL", "//attacker.example/campus"],
    ["a javascript URL", "javascript:alert(1)"],
  ])("rejects %s as off-campus", (_, value) => {
    expect(parseCampusReturnTo(value)).toBeUndefined();
  });

  it.each([
    ["a literal parent segment", "/campus/../admin"],
    ["a nested parent segment that resolves inside campus", "/campus/42/../43"],
    ["a nested parent segment that escapes campus", "/campus/42/../../admin"],
    ["an encoded parent segment", "/campus/%2E%2E/admin"],
    ["a lowercase encoded parent segment", "/campus/%2e%2e/admin"],
    ["a literal current segment", "/campus/./42"],
    ["an encoded current segment", "/campus/%2E/join"],
    ["an encoded slash", "/campus/42%2F..%2Fadmin"],
    ["an empty interior segment", "/campus//42"],
  ])("rejects %s as path traversal", (_, value) => {
    expect(parseCampusReturnTo(value)).toBeUndefined();
  });

  it.each([
    ["a backslash host trick", "/\\attacker.example/campus"],
    ["a backslash inside the path", "/campus\\42"],
    ["an encoded backslash", "/campus/42%5Cadmin"],
    ["a newline", "/campus/42\n/admin"],
    ["a tab", "/campus/\t42"],
    ["a NUL byte", "/campus/42\u0000"],
    ["a DEL byte", "/campus/42\u007f"],
    ["an encoded newline in the path", "/campus/42%0Aadmin"],
    ["malformed percent encoding", "/campus/%E0%A4%A"],
  ])("rejects %s as an unsafe character", (_, value) => {
    expect(parseCampusReturnTo(value)).toBeUndefined();
  });

  it("accepts a destination of exactly 2048 characters", () => {
    const value = `/campus/${"a".repeat(2048 - "/campus/".length)}`;

    expect(parseCampusReturnTo(value)).toBe(value);
  });

  it("rejects a destination longer than 2048 characters", () => {
    const value = `/campus/${"a".repeat(2049 - "/campus/".length)}`;

    expect(parseCampusReturnTo(value)).toBeUndefined();
  });
});

describe("normalizeCampusReturnTo", () => {
  it("returns the sanitized destination when it is valid", () => {
    expect(normalizeCampusReturnTo("/campus/42?tab=people#row")).toBe(
      "/campus/42?tab=people",
    );
  });

  it.each([
    undefined,
    "",
    "/invitation",
    "//attacker.example",
    "/campus/../admin",
  ])("falls back to the campus index for %j", (value) => {
    expect(normalizeCampusReturnTo(value)).toBe("/campus");
  });
});

describe("normalizeCohortReturnTo", () => {
  it.each([
    ["the cohort's campus", "/campus/c-3", "/campus/c-3"],
    ["a trailing slash", "/campus/c-3/", "/campus/c-3/"],
    [
      "a deep link with a query",
      "/campus/c-3/meeting?tab=people#row",
      "/campus/c-3/meeting?tab=people",
    ],
  ])("keeps %s", (_, value, expected) => {
    expect(normalizeCohortReturnTo("c-3", value)).toBe(expected);
  });

  it.each([
    ["no value", undefined],
    ["another cohort", "/campus/c-4/meeting"],
    ["the cohort's pre-join screen", "/campus/c-3/join?returnTo=%2Fcampus"],
    ["an encoded pre-join segment", "/campus/c-3/%6Aoin"],
    ["the campus index", "/campus"],
    ["an off-site URL", "https://attacker.example/campus/c-3"],
    ["a protocol-relative URL", "//attacker.example/campus/c-3"],
    ["a traversal into another cohort", "/campus/c-3/../c-4"],
    ["a cohort prefix lookalike", "/campus/c-33"],
  ])("falls back to the cohort's campus for %s", (_, value) => {
    expect(normalizeCohortReturnTo("c-3", value)).toBe("/campus/c-3");
  });

  it("matches a cohort ID that needs encoding", () => {
    expect(normalizeCohortReturnTo("a b", "/campus/a%20b/meeting")).toBe(
      "/campus/a%20b/meeting",
    );
    expect(normalizeCohortReturnTo("a b", "/campus/c-3")).toBe("/campus/a%20b");
  });
});
