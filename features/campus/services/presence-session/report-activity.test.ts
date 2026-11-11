import { describe, expect, it, vi } from "vitest";

import { createWorldSocialChannel } from "@/core/realtime";
import { serverFrames } from "@/tests/fixtures/world-frames";

import {
  activeIntervalMs,
  MAX_ACTIVE_INTERVAL_MS,
  reportActivity,
  subscribeToBrowserActivity,
} from "./report-activity";

function startReporting({
  awayAfterSeconds = serverFrames.welcome.awayAfterSeconds,
  ready = true,
}: { awayAfterSeconds?: number; ready?: boolean } = {}) {
  const channel = createWorldSocialChannel();
  const send = vi.fn(() => true);
  channel.bind(send);
  const welcome = () => {
    channel.apply({ ...serverFrames.welcome, awayAfterSeconds });
    channel.apply(serverFrames.snapshot);
  };
  if (ready) welcome();
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
    listeners,
    send,
    stop,
    welcome,
  };
}

describe("activeIntervalMs", () => {
  it.each([
    [600, MAX_ACTIVE_INTERVAL_MS],
    [240, MAX_ACTIVE_INTERVAL_MS],
    [120, 30_000],
    [1, 250],
  ])("sends well within %s seconds of idling", (awayAfterSeconds, expected) => {
    expect(activeIntervalMs(awayAfterSeconds)).toBe(expected);
  });
});

describe("reportActivity", () => {
  it("sends active on the first activity", () => {
    const { act, send } = startReporting();

    act();

    expect(send).toHaveBeenCalledExactlyOnceWith({ type: "active" });
  });

  it.each([300, 120])(
    "sends at most once per interval when world idles after %s seconds",
    (awayAfterSeconds) => {
      const { act, advance, send } = startReporting({ awayAfterSeconds });
      const interval = activeIntervalMs(awayAfterSeconds);

      act();
      advance(interval - 1);
      act();
      expect(send).toHaveBeenCalledOnce();

      advance(1);
      act();
      expect(send).toHaveBeenCalledTimes(2);
    },
  );

  it("sends nothing when world never shows anyone away", () => {
    const { act, send } = startReporting({ awayAfterSeconds: 0 });

    act();

    expect(send).not.toHaveBeenCalled();
  });

  it("sends nothing before world is ready, then sends on the next activity", () => {
    const { act, send, welcome } = startReporting({ ready: false });

    act();
    expect(send).not.toHaveBeenCalled();

    welcome();
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
    ["a scroll", () => new WheelEvent("wheel")],
  ])("hears %s until unsubscribed", (_, createEvent) => {
    const listener = vi.fn();
    const unsubscribe = subscribeToBrowserActivity(listener);

    window.dispatchEvent(createEvent());
    unsubscribe();
    window.dispatchEvent(createEvent());

    expect(listener).toHaveBeenCalledOnce();
  });
});
