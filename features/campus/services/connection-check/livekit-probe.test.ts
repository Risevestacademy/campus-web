import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeLivekit, fakeTrack } from "../../testing/fake-livekit";
import { loadLivekitProbe } from "./livekit-probe";

const GRANT = {
  url: "wss://media.example.test",
  token: "eyJ.connection-check.token",
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

describe("loadLivekitProbe", () => {
  it("connects to the granted media server", async () => {
    const livekit = fakeLivekit();

    await loadLivekitProbe(GRANT, async () => livekit.module);

    expect(livekit.constructed).toEqual([GRANT]);
  });

  it("passes the network after the websocket, WebRTC and TURN checks", async () => {
    const livekit = fakeLivekit({ turn: "SKIPPED" });
    const probe = await loadLivekitProbe(GRANT, async () => livekit.module);

    await expect(probe.network()).resolves.toBe(true);
    expect(livekit.ran).toEqual(["websocket", "webrtc", "turn"]);
  });

  it("stops the network at the first failing check", async () => {
    const livekit = fakeLivekit({ webrtc: "FAILED" });
    const probe = await loadLivekitProbe(GRANT, async () => livekit.module);

    await expect(probe.network()).resolves.toBe(false);
    expect(livekit.ran).toEqual(["websocket", "webrtc"]);
  });

  it("publishes a copy of the member's track and stops only the copy", async () => {
    const livekit = fakeLivekit({ packetsSent: 120 });
    const probe = await loadLivekitProbe(GRANT, async () => livekit.module);
    const track = fakeTrack("audio");

    await expect(settle(probe.publish(track))).resolves.toBe(true);
    expect(livekit.published).toEqual([track.copy]);
    expect(track.copy.stop).toHaveBeenCalledOnce();
    expect(track.stop).not.toHaveBeenCalled();
  });

  it("fails a track that sends no packets", async () => {
    const livekit = fakeLivekit({ packetsSent: 0 });
    const probe = await loadLivekitProbe(GRANT, async () => livekit.module);
    const track = fakeTrack("video");

    await expect(settle(probe.publish(track))).resolves.toBe(false);
    expect(track.copy.stop).toHaveBeenCalledOnce();
  });

  it("fails, and still stops the copy, when the track cannot be published", async () => {
    const livekit = fakeLivekit({ publishFails: true });
    const probe = await loadLivekitProbe(GRANT, async () => livekit.module);
    const track = fakeTrack("audio");

    await expect(settle(probe.publish(track))).resolves.toBe(false);
    expect(track.copy.stop).toHaveBeenCalledOnce();
    expect(track.stop).not.toHaveBeenCalled();
  });
});
