// @vitest-environment node

import { describe, expect, it } from "vitest";

import { EMPTY_PRESENCE, type Presence } from "./presence";
import {
  claimEntryRefusals,
  entryRefusalsClaimed,
  isSpaceLocked,
  ownSpaceKeyOf,
  refusedEntryNotice,
} from "./space-locks";

const presence: Presence = {
  ...EMPTY_PRESENCE,
  selfId: "ada",
  participants: new Map([
    [
      "ada",
      {
        userId: "ada",
        displayName: "Ada",
        spriteKey: null,
        status: "available",
        statusUntil: null,
        spaceKey: "room_1",
      },
    ],
  ]),
  lockableSpaces: ["room_1", "room_2"],
  lockedSpaces: ["room_2"],
  spaceNames: new Map([["room_2", "Room 2"]]),
};

describe("ownSpaceKeyOf", () => {
  it("is the space the member stands in", () => {
    expect(ownSpaceKeyOf(presence)).toBe("room_1");
  });

  it("is null before world says who the member is", () => {
    expect(ownSpaceKeyOf({ ...presence, selfId: null })).toBeNull();
  });
});

describe("isSpaceLocked", () => {
  it.each([
    ["room_2", true],
    ["room_1", false],
  ])("reads %s as locked: %s", (spaceKey, locked) => {
    expect(isSpaceLocked(presence, spaceKey)).toBe(locked);
  });
});

describe("refusedEntryNotice", () => {
  it.each([
    ["room_2", "Room 2 is locked"],
    ["library", "library is private"],
    [null, "You can't enter that space"],
  ])("words a refusal at %s as %j", (spaceKey, notice) => {
    expect(refusedEntryNotice(presence, spaceKey)).toBe(notice);
  });
});

describe("claimEntryRefusals", () => {
  it("holds a cohort's refusals until every claim is released", () => {
    const first = claimEntryRefusals("c-1");
    const second = claimEntryRefusals("c-1");

    expect(entryRefusalsClaimed("c-1")).toBe(true);
    expect(entryRefusalsClaimed("c-2")).toBe(false);
    first();
    first();
    expect(entryRefusalsClaimed("c-1")).toBe(true);
    second();
    expect(entryRefusalsClaimed("c-1")).toBe(false);
  });
});
