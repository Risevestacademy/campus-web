import { describe, expect, it, vi } from "vitest";

import { serverFrames } from "@/tests/fixtures/world-frames";

import {
  createWorldSocialChannel,
  SAY_MAX_LENGTH,
  STATUS_DURATION_MAX_SECONDS,
  STATUS_DURATION_MIN_SECONDS,
  type WorldSocialChannel,
} from "./social-channel";

function readyChannel() {
  const channel = createWorldSocialChannel();
  const send = vi.fn(() => true);
  channel.bind(send);
  channel.apply(serverFrames.welcome);
  channel.apply(serverFrames.snapshot);
  return { channel, send };
}

const SENDERS: [string, (channel: WorldSocialChannel) => boolean, unknown][] = [
  ["active", (channel) => channel.sendActive(), { type: "active" }],
  [
    "answerEntryRequest",
    (channel) => channel.sendAnswerEntryRequest("r1", true),
    { type: "answerEntryRequest", requestId: "r1", admit: true },
  ],
  [
    "mute",
    (channel) => channel.sendMute("grace"),
    { type: "mute", userId: "grace" },
  ],
  [
    "removeFromSpace",
    (channel) => channel.sendRemoveFromSpace("grace"),
    { type: "removeFromSpace", userId: "grace" },
  ],
  [
    "requestEntry",
    (channel) => channel.sendRequestEntry("library"),
    { type: "requestEntry", spaceKey: "library" },
  ],
  [
    "say",
    (channel) => channel.sendSay("Hello"),
    { type: "say", text: "Hello" },
  ],
  [
    "setLock",
    (channel) => channel.sendSetLock(true),
    { type: "setLock", locked: true },
  ],
  [
    "setStatus",
    (channel) => channel.sendSetStatus("busy"),
    { type: "setStatus", status: "busy" },
  ],
  [
    "withdrawEntryRequest",
    (channel) => channel.sendWithdrawEntryRequest("r1"),
    { type: "withdrawEntryRequest", requestId: "r1" },
  ],
];

describe("createWorldSocialChannel", () => {
  it.each(SENDERS)(
    "sends %s once world has welcomed and placed the member",
    (_, sendIt, frame) => {
      const channel = createWorldSocialChannel();
      const send = vi.fn(() => true);
      channel.bind(send);

      channel.apply(serverFrames.welcome);
      expect(sendIt(channel)).toBe(false);

      channel.apply(serverFrames.snapshot);
      expect(sendIt(channel)).toBe(true);
      expect(send).toHaveBeenCalledExactlyOnceWith(frame);
    },
  );

  it.each(SENDERS)("does not send %s after a disconnect", (_, sendIt) => {
    const { channel, send } = readyChannel();

    channel.disconnect();

    expect(sendIt(channel)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it.each(SENDERS)("does not send %s before anything is bound", (_, sendIt) => {
    const channel = createWorldSocialChannel();
    channel.apply(serverFrames.welcome);
    channel.apply(serverFrames.snapshot);

    expect(sendIt(channel)).toBe(false);
  });

  it("needs a snapshot after every welcome", () => {
    const { channel, send } = readyChannel();

    channel.apply(serverFrames.welcome);

    expect(channel.sendActive()).toBe(false);
    channel.apply(serverFrames.snapshot);
    expect(channel.sendActive()).toBe(true);
    expect(send).toHaveBeenCalledOnce();
  });

  it("does not become ready from a snapshot that came without a welcome", () => {
    const channel = createWorldSocialChannel();
    channel.bind(() => true);

    channel.apply(serverFrames.snapshot);

    expect(channel.sendActive()).toBe(false);
  });

  it("reads world's away timeout only while ready", () => {
    const channel = createWorldSocialChannel();
    const release = channel.bind(() => true);

    channel.apply(serverFrames.welcome);
    expect(channel.readAwayAfterSeconds()).toBeNull();
    channel.apply(serverFrames.snapshot);
    expect(channel.readAwayAfterSeconds()).toBe(
      serverFrames.welcome.awayAfterSeconds,
    );

    channel.disconnect();
    expect(channel.readAwayAfterSeconds()).toBeNull();
    release();
    channel.apply(serverFrames.snapshot);
    expect(channel.readAwayAfterSeconds()).toBeNull();
  });

  it("reports false when the socket takes nothing", () => {
    const channel = createWorldSocialChannel();
    channel.bind(() => false);
    channel.apply(serverFrames.welcome);
    channel.apply(serverFrames.snapshot);

    expect(channel.sendSay("Hello")).toBe(false);
  });

  it("stops sending once the binding is released, and ignores a stale release", () => {
    const channel = createWorldSocialChannel();
    const first = vi.fn(() => true);
    const second = vi.fn(() => true);
    const releaseFirst = channel.bind(first);
    channel.bind(second);
    channel.apply(serverFrames.welcome);
    channel.apply(serverFrames.snapshot);

    releaseFirst();
    expect(channel.sendActive()).toBe(true);
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });

  describe("say", () => {
    it("sends the trimmed line", () => {
      const { channel, send } = readyChannel();

      expect(channel.sendSay("  Hello there \n")).toBe(true);

      expect(send).toHaveBeenCalledExactlyOnceWith({
        type: "say",
        text: "Hello there",
      });
    });

    it.each([
      ["nothing", ""],
      ["blanks", "   \n\t"],
      ["more than world allows", "x".repeat(SAY_MAX_LENGTH + 1)],
    ])("sends nothing for %s", (_, text) => {
      const { channel, send } = readyChannel();

      expect(channel.sendSay(text)).toBe(false);
      expect(send).not.toHaveBeenCalled();
    });

    it("sends a line of exactly the limit", () => {
      const { channel, send } = readyChannel();

      expect(channel.sendSay("x".repeat(SAY_MAX_LENGTH))).toBe(true);
      expect(send).toHaveBeenCalledOnce();
    });
  });

  describe("setStatus for a while", () => {
    it("sends the duration", () => {
      const { channel, send } = readyChannel();

      expect(channel.sendSetStatus("busy", 300)).toBe(true);

      expect(send).toHaveBeenCalledExactlyOnceWith({
        type: "setStatus",
        status: "busy",
        forSeconds: 300,
      });
    });

    it.each([STATUS_DURATION_MIN_SECONDS, STATUS_DURATION_MAX_SECONDS])(
      "accepts the limit of %s seconds",
      (seconds) => {
        const { channel } = readyChannel();

        expect(channel.sendSetStatus("away", seconds)).toBe(true);
      },
    );

    it.each([
      ["too short", STATUS_DURATION_MIN_SECONDS - 1],
      ["too long", STATUS_DURATION_MAX_SECONDS + 1],
      ["not a whole number", 90.5],
      ["not a number", Number.NaN],
      ["negative", -60],
    ])("sends nothing for a duration that is %s", (_, seconds) => {
      const { channel, send } = readyChannel();

      expect(channel.sendSetStatus("busy", seconds)).toBe(false);
      expect(send).not.toHaveBeenCalled();
    });
  });
});
