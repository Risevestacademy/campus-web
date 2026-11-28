import { describe, expect, it } from "vitest";

import type { Presence } from "@/core/presence";

import { selectChatPeople } from "./chat-people";

type Person =
  Presence["participants"] extends ReadonlyMap<string, infer P> ? P : never;

function person(userId: string, displayName: string | null): Person {
  return {
    userId,
    x: 1,
    y: 1,
    facing: "down",
    displayName,
    spriteKey: null,
    status: "available",
    statusUntil: null,
    spaceKey: "library",
  } as Person;
}

const ADA = person("ada", "Ada Lovelace");
const GRACE = person("grace", "Grace Hopper");

function presence(overrides: Partial<Presence> = {}) {
  return {
    selfId: "ada",
    participants: new Map([
      ["ada", ADA],
      ["grace", GRACE],
    ]),
    meetingRoster: ["grace"],
    encounter: 1,
    hearing: "room",
    spaceNames: new Map([["library", "Library"]]),
    ...overrides,
  } as Presence;
}

describe("selectChatPeople", () => {
  it("lists the people in the meeting, the member first", () => {
    const chat = selectChatPeople(presence());

    expect(chat.people.map(({ id }) => id)).toEqual(["ada", "grace"]);
    expect(chat.localId).toBe("ada");
    expect(chat.hearing).toBe("room");
    expect(chat.spaceName).toBe("Library");
  });

  it("says people nearby in a corridor, with no space name", () => {
    const chat = selectChatPeople(presence({ hearing: "proximity" }));

    expect(chat.hearing).toBe("proximity");
    expect(chat.spaceName).toBeNull();
  });

  it("lists only the member when nobody else is near", () => {
    const chat = selectChatPeople(presence({ meetingRoster: [] }));

    expect(chat.people.map(({ id }) => id)).toEqual(["ada"]);
    expect(chat.localId).toBe("ada");
    expect(chat.hearing).toBe("room");
    expect(chat.spaceName).toBe("Library");
  });

  it("lists nobody before the member is placed", () => {
    const chat = selectChatPeople(
      presence({ selfId: null, meetingRoster: [], hearing: null }),
    );

    expect(chat.people).toEqual([]);
    expect(chat.localId).toBeNull();
    expect(chat.hearing).toBe("proximity");
  });

  it("drops a roster entry that is no longer a participant", () => {
    const chat = selectChatPeople(
      presence({ meetingRoster: ["grace", "gone"] }),
    );

    expect(chat.people.map(({ id }) => id)).toEqual(["ada", "grace"]);
  });
});
