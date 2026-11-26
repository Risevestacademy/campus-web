import { describe, expect, it } from "vitest";

import { roomLinkAccess } from "./room-link-access";

describe("roomLinkAccess", () => {
  it.each([
    [{ administrator: true }, "any-space"],
    [{ administrator: true, role: "student" as const }, "any-space"],
    [{ administrator: false, role: "professor" as const }, "own-space"],
    [{ administrator: false, role: "mentor" as const }, "own-space"],
    [{ administrator: false, role: "student" as const }, "none"],
    [{ administrator: false, role: "guest" as const }, "none"],
    [{ administrator: false }, "none"],
  ])("%j is %s", (who, access) => {
    expect(roomLinkAccess(who)).toBe(access);
  });
});
