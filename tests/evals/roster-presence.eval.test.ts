// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  applyServerMessage,
  EMPTY_PRESENCE,
  type Presence,
} from "@/core/presence";
import type { ServerMessage } from "@/core/realtime";
import { toRosterParticipants } from "@/features/roster/presence-participants";
import { parseCohortDirectory } from "@/features/roster/schemas/directory.schema";
import {
  avatar,
  snapshot,
  welcome,
} from "@/features/roster/testing/world-messages";

const PROTOTYPE_KEYS = [
  "__proto__",
  "constructor",
  "toString",
  "hasOwnProperty",
];
const ROW_KEYS = [
  "avatarClassName",
  "detail",
  "id",
  "initial",
  "name",
  "status",
];

function presenceAfter(...messages: ServerMessage[]): Presence {
  return messages.reduce(applyServerMessage, EMPTY_PRESENCE);
}

function rosterOf(presence: Presence, directory?: { id: string }[]) {
  return toRosterParticipants(
    presence.participants,
    presence.selfId,
    directory?.map(({ id }) => ({ id, displayName: id })),
  );
}

describe("roster rows from presence", () => {
  it("shows a person once however many times they joined", () => {
    const presence = presenceAfter(
      welcome("me"),
      snapshot(avatar("me")),
      { type: "joined", player: avatar("ada") },
      { type: "joined", player: avatar("ada") },
      { type: "joined", player: avatar("ada", { status: "busy" }) },
    );

    const { online } = rosterOf(presence);

    expect(online.map(({ id }) => id)).toEqual(["me", "ada"]);
    expect(online[1]).toMatchObject({ status: "busy" });
  });

  it("drops somebody who left while the socket was down, and lists them offline", () => {
    const directory = [{ id: "me" }, { id: "ada" }, { id: "bola" }];
    const before = presenceAfter(
      welcome("me"),
      snapshot(avatar("me"), avatar("ada"), avatar("bola")),
    );

    const after = applyServerMessage(
      before,
      snapshot(avatar("me"), avatar("bola")),
    );
    const { online, offline } = rosterOf(after, directory);

    expect(online.map(({ id }) => id)).toEqual(["me", "bola"]);
    expect(offline?.map(({ id }) => id)).toEqual(["ada"]);
  });

  it.each(PROTOTYPE_KEYS)("treats the id %j as an ordinary person", (id) => {
    const presence = presenceAfter(
      welcome("me"),
      snapshot(avatar("me"), avatar(id)),
    );

    const { online, offline } = rosterOf(presence, [{ id }, { id: "other" }]);

    expect(online.map((row) => row.id)).toEqual(["me", id]);
    expect(offline?.map((row) => row.id)).toEqual(["other"]);
  });

  it.each([
    ["null", null, "Campus member"],
    ["blank", "  \t ", "Campus member"],
    ["an emoji", "🧑🏽‍💻 Dev", "🧑🏽‍💻 Dev"],
    ["combining marks", "Zoë", "Zoë"],
    ["right-to-left", "אברהם", "אברהם"],
  ])("renders %s names without breaking", (_, displayName, name) => {
    const presence = presenceAfter(
      welcome("me"),
      snapshot(avatar("ada", { displayName })),
    );

    const { online, offline } = toRosterParticipants(
      presence.participants,
      presence.selfId,
      [{ id: "bola", displayName }],
    );

    expect(online[0]).toMatchObject({ name });
    expect(offline?.[0]).toMatchObject({ name });
    expect(online[0]?.initial).not.toBe("");
    expect(offline?.[0]?.initial).not.toBe("");
  });

  it("keeps the same list while people only walk", () => {
    const before = presenceAfter(
      welcome("me"),
      snapshot(avatar("me"), avatar("ada")),
    );

    const after = [
      applyServerMessage(before, {
        type: "moved",
        players: [{ userId: "ada", x: 9, y: 9, facing: "left" }],
      }),
      applyServerMessage(before, {
        type: "nearby",
        userIds: ["ada"],
      }),
    ];

    for (const presence of after) {
      expect(presence.participants).toBe(before.participants);
      expect(rosterOf(presence)).toEqual(rosterOf(before));
    }
  });

  it("shows only what the roster reads, never a role, place or do-not-disturb state", () => {
    const presence = presenceAfter(
      welcome("me"),
      snapshot(
        avatar("me"),
        avatar("ada", { x: 7, y: 8, status: "busy", spaceKey: "library" }),
      ),
    );

    const { online, offline } = rosterOf(presence, [{ id: "bola" }]);

    for (const row of [...online, ...(offline ?? [])]) {
      expect(Object.keys(row).sort()).toEqual(ROW_KEYS);
    }
    expect(JSON.stringify([online, offline])).not.toMatch(
      /role|dnd|do not disturb|library/i,
    );
  });
});

describe("the cohort directory", () => {
  it("keeps only each person's id and name", () => {
    const people = parseCohortDirectory([
      {
        id: "bola",
        displayName: "Bola",
        spriteKey: "placeholder-1",
        email: "bola@example.test",
        phone: "+2340000000",
        role: "student",
      },
    ]);

    expect(people).toEqual([{ id: "bola", displayName: "Bola" }]);
  });

  it("reads one malformed row as an unreadable directory, not a partial one", () => {
    expect(
      parseCohortDirectory([
        { id: "bola", displayName: "Bola" },
        { id: 7, displayName: "Seven" },
      ]),
    ).toBeUndefined();
  });
});
