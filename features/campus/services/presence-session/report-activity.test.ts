import { describe, expect, it, vi } from "vitest";

import { createWorldSocialChannel } from "@/core/realtime";
import { serverFrames } from "@/tests/fixtures/world-frames";

import {
  ACTIVE_REPORT_INTERVAL_MS,
  reportActivity,
  subscribeToBrowserActivity,
} from "./report-activity";

function startReporting({ ready = true }: { ready?: boolean } = {}) {
  const channel = createWorldSocialChannel();
  const send = vi.fn(() => true);
  channel.bind(send);
  if (ready) {
    channel.apply(serverFrames.welcome);
    channel.apply(serverFrames.snapshot);
  }
  const listeners = new Set<() => void>();
  let time = 0;
  const stop = reportActivity(channel, {
    now: () => time,
    subscribeToActivity(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  return {
    act: () => listeners.forEach((listener) => listener()),
    advance: (ms: number) => (time += ms),
    channel,
    listeners,
    send,
    stop,
  };
}

describe("reportActivity", () => {
  it("sends active on the first activity", () => {
    const { act, send } = startReporting();

    act();

    expect(send).toHaveBeenCalledExactlyOnceWith({ type: "active" });
  });

  it("sends at most once per interval", () => {
    const { act, advance, send } = startReporting();

    act();
    advance(ACTIVE_REPORT_INTERVAL_MS - 1);
    act();
    expect(send).toHaveBeenCalledOnce();

    advance(1);
    act();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("sends nothing before world is ready, then sends on the next activity", () => {
    const { act, channel, send } = startReporting({ ready: false });

    act();
    expect(send).not.toHaveBeenCalled();

    channel.apply(serverFrames.welcome);
    channel.apply(serverFrames.snapshot);
    act();
    expect(send).toHaveBeenCalledExactlyOnceWith({ type: "active" });
  });

  it("stops listening when the session ends", () => {
    const { act, listeners, send, stop } = startReporting();

    stop();
    act();

    expect(listeners.size).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("subscribeToBrowserActivity", () => {
  it.each([
    ["a key press", () => new KeyboardEvent("keydown")],
    ["a click", () => new PointerEvent("pointerdown")],
    ["a pointer move", () => new PointerEvent("pointermove")],
  ])("hears %s until unsubscribed", (_, createEvent) => {
    const listener = vi.fn();
    const unsubscribe = subscribeToBrowserActivity(listener);

    window.dispatchEvent(createEvent());
    unsubscribe();
    window.dispatchEvent(createEvent());

    expect(listener).toHaveBeenCalledOnce();
  });
});
