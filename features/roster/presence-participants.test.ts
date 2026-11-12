// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createPresenceStore } from "@/core/presence";
import { AVATAR_TONES } from "@/shared/lib/avatar";

import { toRosterParticipants } from "./presence-participants";
import { avatar, snapshot, welcome } from "./testing/world-messages";

function presenceOf(selfId: string, ...players: ReturnType<typeof avatar>[]) {
  const store = createPresenceStore();
  store.getState().apply(welcome(selfId));
  store.getState().apply(snapshot(...players));
  return store.getState();
}

describe("toRosterParticipants", () => {
  it("puts the member first, as You, and keeps the others in store order", () => {
    const { participants, selfId } = presenceOf(
      "grace",
      avatar("ada", { displayName: "Ada" }),
      avatar("grace", { displayName: "Grace" }),
      avatar("lin", { displayName: "Lin" }),
    );

    const { online } = toRosterParticipants(participants, selfId, undefined);

    expect(online.map(({ id, detail }) => [id, detail])).toEqual([
      ["grace", "You"],
      ["ada", "Available"],
      ["lin", "Available"],
    ]);
  });

  it.each([
    [{ status: "available", spaceKey: "_default" }, "available", "Available"],
    [{ status: "available", spaceKey: "library" }, "available", "In a room"],
    [{ status: "busy", spaceKey: "library" }, "busy", "Busy"],
    [{ status: "away", spaceKey: "_default" }, "away", "Away"],
    [{ status: "unknown", spaceKey: "_default" }, "available", "Available"],
  ] as const)("reads %j as %s", (where, status, detail) => {
    const { participants } = presenceOf("me", avatar("ada", where));

    const { online } = toRosterParticipants(participants, "me", undefined);

    expect(online[0]).toMatchObject({ status, detail });
  });

  it.each([
    ["busy", "ada", "Busy · 4 min"],
    ["away", "ada", "Away · 1 h 52 min"],
    ["busy", "me", "You · Busy · 4 min"],
    ["away", "me", "You · Away · 1 h 52 min"],
  ] as const)("shows a timed %s for %s as %j", (status, userId, detail) => {
    const now = Date.parse("2026-10-30T09:00:00.000Z");
    const minutes = status === "busy" ? 4 : 112;
    const statusUntil = new Date(now + minutes * 60_000).toISOString();
    const { participants } = presenceOf(
      "me",
      avatar(userId, { status, statusUntil }),
    );

    const { online } = toRosterParticipants(participants, "me", undefined, now);

    expect(online[0]?.detail).toBe(detail);
  });

  it("drops the time once a timer has run out, before world says so", () => {
    const now = Date.parse("2026-10-30T09:00:00.000Z");
    const { participants } = presenceOf(
      "me",
      avatar("ada", {
        status: "busy",
        statusUntil: "2026-10-30T08:59:00.000Z",
      }),
    );

    const { online } = toRosterParticipants(participants, "me", undefined, now);

    expect(online[0]?.detail).toBe("Busy");
  });

  it.each([
    [null, "Campus member", "C"],
    ["", "Campus member", "C"],
    ["   ", "Campus member", "C"],
    ["  ada ", "ada", "A"],
    ["😀 Smile", "😀 Smile", "😀"],
    ["é́ngela", "é́ngela", "É́"],
    ["مريم", "مريم", "م"],
  ])("shows %j as %j with the initial %j", (displayName, name, initial) => {
    const { participants } = presenceOf("me", avatar("ada", { displayName }));

    const { online } = toRosterParticipants(participants, "me", undefined);

    expect(online[0]).toMatchObject({ name: name.trim(), initial });
  });

  it("never shows a user ID as a name", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const { participants } = presenceOf(
      "me",
      avatar(id, { displayName: null }),
    );

    const { online } = toRosterParticipants(participants, "me", undefined);

    expect(online[0]?.name).toBe("Campus member");
  });

  it("lists the directory minus whoever is online as Offline, once each", () => {
    const { participants, selfId } = presenceOf(
      "ada",
      avatar("ada", { displayName: "Ada" }),
    );

    const { offline } = toRosterParticipants(participants, selfId, [
      { id: "ada", displayName: "Ada" },
      { id: "bola", displayName: "Bola" },
      { id: "bola", displayName: "Bola" },
      { id: "chi", displayName: null },
    ]);

    expect(offline).toEqual([
      expect.objectContaining({
        id: "bola",
        status: "offline",
        detail: "",
      }),
      expect.objectContaining({ id: "chi", name: "Campus member" }),
    ]);
  });

  it("marks only the member's own row as theirs", () => {
    const { participants } = presenceOf("me", avatar("me"), avatar("ada"));

    const { online, offline } = toRosterParticipants(participants, "me", [
      { id: "bola", displayName: "Bola" },
    ]);

    expect(online.map(({ id, isSelf }) => [id, isSelf])).toEqual([
      ["me", true],
      ["ada", false],
    ]);
    expect(offline?.[0]?.isSelf).toBe(false);
  });

  it("has no Offline group without a directory", () => {
    const { participants, selfId } = presenceOf("ada", avatar("ada"));

    expect(toRosterParticipants(participants, selfId, undefined).offline).toBe(
      undefined,
    );
  });

  it("treats ordinary-looking prototype names as plain user IDs", () => {
    const ids = ["__proto__", "constructor", "toString", "hasOwnProperty"];
    const { participants } = presenceOf("me", ...ids.map((id) => avatar(id)));

    const { online, offline } = toRosterParticipants(
      participants,
      "me",
      ids.map((id) => ({ id, displayName: id })),
    );

    expect(online.map(({ id }) => id)).toEqual(ids);
    expect(offline).toEqual([]);
  });

  describe("avatar colors", () => {
    const ids = Array.from(
      { length: 40 },
      (_, index) => `${index}0000000-1111-4111-8111-111111111111`,
    );

    function tonesOf(directoryIds: string[]) {
      const { participants } = presenceOf(
        "me",
        ...directoryIds.map((id) => avatar(id)),
      );
      const { online } = toRosterParticipants(participants, "me", undefined);
      return online.map(({ id, avatarClassName }) => [id, avatarClassName]);
    }

    it("gives a person the same color whoever else is here, and online or off", () => {
      const alone = tonesOf([ids[3]!]);
      const crowd = tonesOf(ids);
      const { offline } = toRosterParticipants(new Map(), null, [
        { id: ids[3]!, displayName: null },
      ]);

      expect(crowd).toContainEqual(alone[0]);
      expect(offline?.[0]?.avatarClassName).toBe(alone[0]?.[1]);
    });

    it("draws only from the palette, and uses all of it", () => {
      const used = new Set(tonesOf(ids).map(([, tone]) => tone));

      expect(
        [...used].every((tone) => AVATAR_TONES.includes(tone as never)),
      ).toBe(true);
      expect(used.size).toBe(AVATAR_TONES.length);
    });

    it("never borrows a status color", () => {
      expect(AVATAR_TONES.join(" ")).not.toMatch(/success|error|warning/);
    });
  });
});
