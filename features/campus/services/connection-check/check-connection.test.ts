import { describe, expect, it, vi } from "vitest";

import {
  checkConnection,
  type CheckConnectionDependencies,
} from "./check-connection";
import type { ConnectionCheckAccess } from "./connection-check.service";
import type { ConnectionCheckProbe } from "./run-connection-check";

const microphone = { kind: "audio" } as MediaStreamTrack;
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
  };
}

describe("checkConnection", () => {
  it("runs the check against the media server world names", async () => {
    const deps = dependencies(ready);

    await expect(
      checkConnection(deps, { microphone, camera: null }, { onStep: () => {} }),
    ).resolves.toEqual({ kind: "passed" });
    expect(deps.loadProbe).toHaveBeenCalledWith({
      url: "wss://media.example.test",
      token: "eyJ.connection-check.token",
    });
  });

  it("passes the abort signal to world's request", async () => {
    const deps = dependencies(ready);
    const { signal } = new AbortController();

    await checkConnection(
      deps,
      { microphone: null, camera: null },
      { onStep: () => {}, signal },
    );

    expect(deps.requestAccess).toHaveBeenCalledWith(signal);
  });

  it.each<ConnectionCheckAccess>([
    { kind: "unavailable" },
    { kind: "rate-limited", retryAfterSeconds: 30 },
    { kind: "signed-out" },
    { kind: "misconfigured" },
    { kind: "failed" },
  ])("answers $kind without loading the media SDK", async (access) => {
    const deps = dependencies(access);
    const onStep = vi.fn();

    await expect(
      checkConnection(deps, { microphone, camera: null }, { onStep }),
    ).resolves.toEqual(access);
    expect(deps.loadProbe).not.toHaveBeenCalled();
    expect(onStep).not.toHaveBeenCalled();
  });
});
