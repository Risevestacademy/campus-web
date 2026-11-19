import { describe, expect, it } from "vitest";

import type { ChatLine, Participant } from "@/core/presence";

import {
  type ChatMessage,
  formatChatTime,
  groupMessages,
  messageOf,
  selectChatLines,
  selectChatMessages,
  unreadCount,
} from "./chat-messages";

function participant(
  userId: string,
  displayName: string | null,
  spaceKey: string,
) {
  return {
    userId,
    displayName,
    spriteKey: null,
    status: "available",
    statusUntil: null,
    spaceKey,
  } as Participant;
}

const ADA = participant("ada", "Ada Lovelace", "library");
const GRACE = participant("grace", "Grace Hopper", "library");

function line(
  id: string,
  userId: string,
  overrides: Partial<ChatLine> = {},
): ChatLine {
  return {
    id,
    userId,
    spaceKey: "library",
    text: `line ${id}`,
    attachment: null,
    at: "2026-11-17T15:01:10.000Z",
    senderName: null,
    ...overrides,
  };
}

function presence(chat: readonly ChatLine[], selfId: string | null = "ada") {
  return {
    chat,
    selfId,
    participants: new Map([
      ["ada", ADA],
      ["grace", GRACE],
    ]),
  };
}

describe("selectChatLines", () => {
  it("keeps the lines said in the member's own space", () => {
    const lines = selectChatLines(
      presence([
        line("a", "grace"),
        line("b", "grace", { spaceKey: "studio" }),
      ]),
    );

    expect(lines.map(({ id }) => id)).toEqual(["a"]);
  });

  it("shows nothing before the member is placed", () => {
    expect(selectChatLines(presence([line("a", "grace")], null))).toEqual([]);
  });
});

describe("messageOf", () => {
  it("names the member's own line You, with the initial of their own name", () => {
    const message = messageOf(
      line("a", "ada", { senderName: "Ada Lovelace" }),
      presence([]),
    );

    expect(message).toMatchObject({ name: "You", initial: "A", isOwn: true });
  });

  it("names a speaker by what they were called when they spoke", () => {
    const message = messageOf(
      line("a", "stranger", { senderName: "Lin Wei" }),
      presence([]),
    );

    expect(message).toMatchObject({
      name: "Lin Wei",
      initial: "L",
      isOwn: false,
    });
  });

  it("falls back to the name they have now, then to Campus member", () => {
    const known = messageOf(line("a", "grace"), presence([]));
    const stranger = messageOf(line("b", "stranger"), presence([]));

    expect(known.name).toBe("Grace Hopper");
    expect(stranger.name).toBe("Campus member");
  });

  it("gives one person the same colour every time", () => {
    const first = messageOf(line("a", "grace"), presence([]));
    const second = messageOf(line("b", "grace"), presence([]));

    expect(first.avatarClassName).toBe(second.avatarClassName);
  });
});

describe("groupMessages", () => {
  const at = (iso: string) => ({ at: iso });
  const messages = (...lines: ChatLine[]): readonly ChatMessage[] =>
    selectChatMessages(presence(lines));

  it("groups one person's lines from the same minute", () => {
    const groups = groupMessages(
      messages(
        line("a", "grace", at("2026-11-17T15:01:05.000Z")),
        line("b", "grace", at("2026-11-17T15:01:50.000Z")),
      ),
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.messages.map(({ id }) => id)).toEqual(["a", "b"]);
    expect(groups[0]?.first.id).toBe("a");
  });

  it("starts a new group for a new minute or a new speaker", () => {
    const groups = groupMessages(
      messages(
        line("a", "grace", at("2026-11-17T15:01:05.000Z")),
        line("b", "grace", at("2026-11-17T15:02:05.000Z")),
        line("c", "ada", at("2026-11-17T15:02:06.000Z")),
        line("d", "grace", at("2026-11-17T15:02:07.000Z")),
      ),
    );

    expect(groups.map((group) => group.messages.map(({ id }) => id))).toEqual([
      ["a"],
      ["b"],
      ["c"],
      ["d"],
    ]);
  });

  it("has no groups for no lines", () => {
    expect(groupMessages([])).toEqual([]);
  });
});

describe("formatChatTime", () => {
  it("shows the time of day, whatever form it arrives in", () => {
    const at = "2026-11-17T15:04:00.000Z";

    expect(formatChatTime(at)).toBe(formatChatTime(Date.parse(at)));
    expect(formatChatTime(at)).toMatch(/\d/);
  });

  it("shows nothing for a time that does not parse", () => {
    expect(formatChatTime("not a time")).toBe("");
  });
});

describe("unreadCount", () => {
  const lines = [
    line("1", "grace"),
    line("2", "ada"),
    line("3", "grace"),
    line("4", "grace"),
  ];

  it("counts everyone else's lines when none has been read", () => {
    expect(unreadCount(lines, "ada", null)).toBe(3);
  });

  it("counts the lines after the newest one read, never the member's own", () => {
    expect(unreadCount(lines, "ada", "2")).toBe(2);
    expect(unreadCount(lines, "ada", "4")).toBe(0);
  });

  it("counts every other line when the one read is gone", () => {
    expect(unreadCount(lines, "ada", "gone")).toBe(3);
  });

  it("counts nothing with no lines", () => {
    expect(unreadCount([], "ada", "1")).toBe(0);
  });
});
