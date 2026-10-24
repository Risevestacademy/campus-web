import { describe, expect, it, vi } from "vitest";

import {
  type ConnectionCheckProbe,
  type ConnectionCheckStep,
  runConnectionCheck,
  type StepStatus,
} from "./run-connection-check";

const microphone = { kind: "audio" } as MediaStreamTrack;
const camera = { kind: "video" } as MediaStreamTrack;

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
      runConnectionCheck(probe, { microphone, camera }, { onStep }),
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
      runConnectionCheck(probe, { microphone, camera }, { onStep }),
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
      runConnectionCheck(probe, { microphone, camera }, { onStep: () => {} }),
    ).resolves.toEqual({ kind: "step-failed", step: "camera" });
  });

  it("skips a source the member turned off", async () => {
    const probe = fakeProbe();
    const { steps, onStep } = recordSteps();

    await expect(
      runConnectionCheck(probe, { microphone, camera: null }, { onStep }),
    ).resolves.toEqual({ kind: "passed" });
    expect(probe.publish.mock.calls).toEqual([[microphone]]);
    expect(steps).toContainEqual(["camera", "skipped"]);
    expect(steps).not.toContainEqual(["camera", "running"]);
  });

  it("starts no further step once aborted", async () => {
    const controller = new AbortController();
    const probe = fakeProbe();
    probe.network.mockImplementation(async () => {
      controller.abort();
      return true;
    });

    await expect(
      runConnectionCheck(
        probe,
        { microphone, camera },
        { onStep: () => {}, signal: controller.signal },
      ),
    ).rejects.toThrow(expect.objectContaining({ name: "AbortError" }));
    expect(probe.publish).not.toHaveBeenCalled();
  });
});
