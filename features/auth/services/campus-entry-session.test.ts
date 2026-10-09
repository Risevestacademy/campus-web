import { describe, expect, it } from "vitest";

import { campusEntryCookieName } from "./campus-entry-session";

describe("campusEntryCookieName", () => {
  it("escapes the cookie separators encodeURIComponent leaves in place", () => {
    expect(campusEntryCookieName("a(b)")).toBe("campus_entry_a%28b%29");
  });
});
