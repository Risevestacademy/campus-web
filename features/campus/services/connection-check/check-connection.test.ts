import { describe, expect, it, vi } from "vitest";

import {
  checkConnection,
  type CheckConnectionDependencies,
} from "./check-connection";
import type { ConnectionCheckAccess } from "./connection-check.service";
import type { ConnectionCheckProbe, ReadTrack } from "./run-connection-check";

const microphone = { kind: "audio", readyState: "live" } as MediaStreamTrack;
const readMicrophone: ReadTrack = (step) =>
  step === "microphone" ? microphone : null;
const readNoTrack: ReadTrack = () => null;
const ready: ConnectionCheckAccess = {
  kind: "ready",
  url: "wss://media.example.test",
  token: "eyJ.connection-check.token",
};

function dependencies(access: ConnectionCheckAccess) {
  const probe: ConnectionCheckProbe = {
    network: async () => true,
    publish: async () => true,
  };
  return {
    requestAccess: vi.fn<CheckConnectionDependencies["requestAccess"]>(
      async () => access,
    ),
    loadProbe: vi.fn<CheckConnectionDependencies["loadProbe"]>(
      async () => probe,
    ),
    captureEvent: vi.fn<CheckConnectionDependencies["captureEvent"]>(),
  };
}

describe("checkConnection", () => {
  it("runs the check against the media server world names", async () => {
    const deps = dependencies(ready);

    await expect(
      checkConnection(deps, readMicrophone, { onStep: () => {} }),
    ).resolves.toEqual({ kind: "passed" });
    expect(deps.loadProbe).toHaveBeenCalledWith({
      url: "wss://media.example.test",
      token: "eyJ.connection-check.token",
    });
  });

  it("passes the abort signal to world's request", async () => {
    const deps = dependencies(ready);
    const { signal } = new AbortController();

    await checkConnection(deps, readNoTrack, { onStep: () => {}, signal });

    expect(deps.requestAccess).toHaveBeenCalledWith(signal);
  });

  it.each<ConnectionCheckAccess>([
    { kind: "unavailable" },
    { kind: "rate-limited", retryAfterSeconds: 30 },
    { kind: "signed-out" },
    { kind: "failed" },
  ])("answers $kind without loading the media SDK", async (access) => {
    const deps = dependencies(access);
    const onStep = vi.fn();

    await expect(
      checkConnection(deps, readMicrophone, { onStep }),
    ).resolves.toEqual(access);
    expect(deps.loadProbe).not.toHaveBeenCalled();
    expect(onStep).not.toHaveBeenCalled();
  });

  it("reports one completed event for a run that finished", async () => {
    const deps = dependencies(ready);
    deps.loadProbe.mockResolvedValueOnce({
      network: async () => false,
      publish: async () => true,
    });

    await checkConnection(deps, readMicrophone, { onStep: () => {} });

    expect(deps.captureEvent.mock.calls).toEqual([
      [{ result: "failed", failed_step: "network" }],
    ]);
  });

  it("reports one completed event for a refusal", async () => {
    const deps = dependencies({ kind: "signed-out" });

    await checkConnection(deps, readMicrophone, { onStep: () => {} });

    expect(deps.captureEvent.mock.calls).toEqual([
      [{ result: "signed_out", failed_step: null }],
    ]);
  });

  it("reports an error, then rethrows, when the run crashes", async () => {
    const deps = dependencies(ready);
    const crash = new Error("Failed to fetch dynamically imported module");
    deps.loadProbe.mockRejectedValueOnce(crash);

    await expect(
      checkConnection(deps, readMicrophone, { onStep: () => {} }),
    ).rejects.toBe(crash);
    expect(deps.captureEvent.mock.calls).toEqual([
      [{ result: "error", failed_step: null }],
    ]);
  });

  it("reports nothing for a run the Join Gate abandoned", async () => {
    const deps = dependencies(ready);
    const controller = new AbortController();
    deps.loadProbe.mockImplementationOnce(async () => {
      controller.abort();
      return { network: async () => true, publish: async () => true };
    });

    await expect(
      checkConnection(deps, readMicrophone, {
        onStep: () => {},
        signal: controller.signal,
      }),
    ).rejects.toThrow(expect.objectContaining({ name: "AbortError" }));
    expect(deps.captureEvent).not.toHaveBeenCalled();
  });
});
