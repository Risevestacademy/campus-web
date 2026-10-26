import { describe, expect, it, vi } from "vitest";

import {
  type ConnectionCheckProbe,
  type ConnectionCheckStep,
  type PublishStep,
  type ReadTrack,
  runConnectionCheck,
  type StepStatus,
} from "./run-connection-check";

const microphone = { kind: "audio", readyState: "live" } as MediaStreamTrack;
const camera = { kind: "video", readyState: "live" } as MediaStreamTrack;

type Tracks = Record<PublishStep, MediaStreamTrack | null>;

function tracksOf(tracks: Tracks): ReadTrack {
  return (step) => tracks[step];
}

function fakeProbe({
  network = true,
  publish = () => true,
}: {
  network?: boolean;
  publish?: (track: MediaStreamTrack) => boolean;
} = {}) {
  return {
    network: vi.fn(async () => network),
    publish: vi.fn(async (track: MediaStreamTrack) => publish(track)),
  } satisfies ConnectionCheckProbe;
}

function recordSteps() {
  const steps: [ConnectionCheckStep, StepStatus][] = [];
  return {
    steps,
    onStep: (step: ConnectionCheckStep, status: StepStatus) => {
      steps.push([step, status]);
    },
  };
}

describe("runConnectionCheck", () => {
  it("passes after the network, the microphone and the camera", async () => {
    const probe = fakeProbe();
    const { steps, onStep } = recordSteps();

    await expect(
      runConnectionCheck(probe, tracksOf({ microphone, camera }), { onStep }),
    ).resolves.toEqual({ kind: "passed" });
    expect(probe.publish.mock.calls).toEqual([[microphone], [camera]]);
    expect(steps).toEqual([
      ["network", "running"],
      ["network", "passed"],
      ["microphone", "running"],
      ["microphone", "passed"],
      ["camera", "running"],
      ["camera", "passed"],
    ]);
  });

  it("stops at a network that blocks calls", async () => {
    const probe = fakeProbe({ network: false });
    const { steps, onStep } = recordSteps();

    await expect(
      runConnectionCheck(probe, tracksOf({ microphone, camera }), { onStep }),
    ).resolves.toEqual({ kind: "step-failed", step: "network" });
    expect(probe.publish).not.toHaveBeenCalled();
    expect(steps).toEqual([
      ["network", "running"],
      ["network", "failed"],
    ]);
  });

  it("names the camera when only the camera cannot send", async () => {
    const probe = fakeProbe({ publish: (track) => track !== camera });

    await expect(
      runConnectionCheck(probe, tracksOf({ microphone, camera }), {
        onStep: () => {},
      }),
    ).resolves.toEqual({ kind: "step-failed", step: "camera" });
  });

  it("skips a source the member turned off", async () => {
    const probe = fakeProbe();
    const { steps, onStep } = recordSteps();

    await expect(
      runConnectionCheck(probe, tracksOf({ microphone, camera: null }), {
        onStep,
      }),
    ).resolves.toEqual({ kind: "passed" });
    expect(probe.publish.mock.calls).toEqual([[microphone]]);
    expect(steps).toContainEqual(["camera", "skipped"]);
    expect(steps).not.toContainEqual(["camera", "running"]);
  });

  it("skips a track that ended before its step", async () => {
    const ended = { kind: "video", readyState: "ended" } as MediaStreamTrack;
    const probe = fakeProbe();
    const { steps, onStep } = recordSteps();

    await expect(
      runConnectionCheck(probe, tracksOf({ microphone, camera: ended }), {
        onStep,
      }),
    ).resolves.toEqual({ kind: "passed" });
    expect(probe.publish.mock.calls).toEqual([[microphone]]);
    expect(steps).toContainEqual(["camera", "skipped"]);
  });

  it("reads each track as its step starts, not at the start of the run", async () => {
    const tracks: Tracks = { microphone, camera: null };
    const probe = fakeProbe();
    probe.network.mockImplementation(async () => {
      tracks.microphone = null;
      tracks.camera = camera;
      return true;
    });
    const { steps, onStep } = recordSteps();

    await expect(
      runConnectionCheck(probe, tracksOf(tracks), { onStep }),
    ).resolves.toEqual({ kind: "passed" });
    expect(probe.publish.mock.calls).toEqual([[camera]]);
    expect(steps).toContainEqual(["microphone", "skipped"]);
    expect(steps).toContainEqual(["camera", "passed"]);
  });

  it("starts no further step once aborted", async () => {
    const controller = new AbortController();
    const probe = fakeProbe();
    probe.network.mockImplementation(async () => {
      controller.abort();
      return true;
    });

    await expect(
      runConnectionCheck(probe, tracksOf({ microphone, camera }), {
        onStep: () => {},
        signal: controller.signal,
      }),
    ).rejects.toThrow(expect.objectContaining({ name: "AbortError" }));
    expect(probe.publish).not.toHaveBeenCalled();
  });
});
