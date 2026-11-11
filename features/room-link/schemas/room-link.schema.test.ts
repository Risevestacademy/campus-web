import { describe, expect, it } from "vitest";

import { parseRoomLinkCode, parseRoomLinkEntry } from "./room-link.schema";

describe("parseRoomLinkCode", () => {
  it.each(["k3F9xQ2pLm", "0123456789", "ABCDEFGHIJ"])("accepts %s", (code) => {
    expect(parseRoomLinkCode(code)).toBe(code);
  });

  it.each([
    ["too short", "k3F9xQ2pL"],
    ["too long", "k3F9xQ2pLmN"],
    ["empty", ""],
    ["a symbol", "k3F9xQ2pL-"],
    ["a space", "k3F9xQ2p m"],
    ["a path", "../campus"],
    ["a non-ASCII letter", "k3F9xQ2pLé"],
  ])("rejects a code that is %s", (_, code) => {
    expect(parseRoomLinkCode(code)).toBeUndefined();
  });
});

describe("parseRoomLinkEntry", () => {
  it("keeps only the cohort and the space", () => {
    expect(
      parseRoomLinkEntry({
        code: "k3F9xQ2pLm",
        url: "https://campus.example/join/k3F9xQ2pLm",
        title: "Design review",
        cohortId: "c-1",
        spaceId: "s-1",
        spaceKey: "library",
        spaceName: "Library",
        startsAt: "2026-11-05T10:00:00.000Z",
        endsAt: null,
        createdAt: "2026-11-03T09:00:00.000Z",
        admitted: true,
      }),
    ).toEqual({ cohortId: "c-1", spaceKey: "library" });
  });

  it.each([
    ["nothing", undefined],
    ["a string", "library"],
    ["no space", { cohortId: "c-1" }],
    ["an empty cohort", { cohortId: "", spaceKey: "library" }],
    ["an empty space", { cohortId: "c-1", spaceKey: "" }],
    ["an overlong space", { cohortId: "c-1", spaceKey: "x".repeat(65) }],
    ["a number for the space", { cohortId: "c-1", spaceKey: 7 }],
  ])("refuses %s", (_, value) => {
    expect(parseRoomLinkEntry(value)).toBeUndefined();
  });
});
