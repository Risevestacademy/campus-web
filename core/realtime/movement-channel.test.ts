import { describe, expect, it, vi } from "vitest";

import { serverFrames } from "@/tests/fixtures/world-frames";

import { createWorldMovementChannel } from "./movement-channel";

describe("createWorldMovementChannel", () => {
  it("enables movement only after welcome and snapshot", () => {
    const channel = createWorldMovementChannel();
    const send = vi.fn(() => true);
    channel.bind(send);

    channel.apply(serverFrames.welcome);
    expect(channel.readStepMs()).toBeNull();
    expect(channel.sendMove({ direction: "right", seq: 1 })).toBe(false);

    channel.apply(serverFrames.snapshot);

    expect(channel.readStepMs()).toBe(100);
    expect(channel.sendMove({ direction: "right", seq: 1 })).toBe(true);
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: "move",
      direction: "right",
      seq: 1,
    });
  });

  it("publishes own movement and remote avatar lifecycle frames", () => {
    const channel = createWorldMovementChannel();
    const received = vi.fn();
    channel.subscribe(received);

    channel.apply(serverFrames.welcome);
    channel.apply(serverFrames.snapshot);
    channel.apply(serverFrames.joined);
    channel.apply(serverFrames.appearance);
    channel.apply(serverFrames.moved);
    channel.apply(serverFrames.left);
    channel.apply(serverFrames.pong);
    channel.apply(serverFrames.moveResult);

    expect(received.mock.calls.map(([message]) => message.type)).toEqual([
      "welcome",
      "snapshot",
      "joined",
      "moved",
      "left",
      "moveResult",
    ]);
  });

  it("disables the old socket until the next snapshot", () => {
    const channel = createWorldMovementChannel();
    const send = vi.fn(() => true);
    channel.bind(send);
    channel.apply(serverFrames.welcome);
    channel.apply(serverFrames.snapshot);

    channel.disconnect();

    expect(channel.readStepMs()).toBeNull();
    expect(channel.sendMove({ direction: "up", seq: 1 })).toBe(false);

    channel.apply({ ...serverFrames.welcome, stepMs: 125 });
    channel.apply(serverFrames.snapshot);

    expect(channel.readStepMs()).toBe(125);
  });

  it("lets only the current binding detach the sender", () => {
    const channel = createWorldMovementChannel();
    const first = vi.fn(() => true);
    const second = vi.fn(() => true);
    const unbindFirst = channel.bind(first);
    channel.bind(second);
    channel.apply(serverFrames.welcome);
    channel.apply(serverFrames.snapshot);

    unbindFirst();
    channel.sendMove({ direction: "left", seq: 7 });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledExactlyOnceWith({
      type: "move",
      direction: "left",
      seq: 7,
    });
  });
});
