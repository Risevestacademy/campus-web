import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoreApi } from "zustand";

import type { ConnectionCheckResult } from "../services/connection-check/check-connection";
import {
  type ConnectionCheckRunOptions,
  type ReadTrack,
  runConnectionCheck,
} from "../services/connection-check/run-connection-check";
import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import {
  createMediaSessionStore,
  type MediaSessionState,
} from "../services/media-session/media-session-store";
import {
  createTestMediaDevice,
  createTestMediaTrack,
  installTestMediaDevices,
} from "../testing/media-session-test-utils";
import { useConnectionCheck } from "./use-connection-check";

type CheckCall = { readTrack: ReadTrack; options: ConnectionCheckRunOptions };

function deferredCheck() {
  const calls: CheckCall[] = [];
  let finish: (result: ConnectionCheckResult) => void = () => {};
  const check = vi.fn(
    (readTrack: ReadTrack, options: ConnectionCheckRunOptions) => {
      calls.push({ readTrack, options });
      return new Promise<ConnectionCheckResult>((resolve) => {
        finish = resolve;
      });
    },
  );
  return {
    check,
    calls,
    finish: (result: ConnectionCheckResult) => finish(result),
  };
}

function renderWithStore(
  check: Parameters<typeof useConnectionCheck>[0],
  store: StoreApi<MediaSessionState>,
) {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MediaSessionProvider store={store}>{children}</MediaSessionProvider>
    </QueryClientProvider>
  );

  return renderHook(() => useConnectionCheck(check), { wrapper });
}

function renderConnectionCheck(
  check: Parameters<typeof useConnectionCheck>[0],
  microphone: MediaStreamTrack | null = null,
) {
  const store = createMediaSessionStore({ mediaDevices: null });
  store.setState({
    microphone: { ...store.getState().microphone, track: microphone },
  });
  return renderWithStore(check, store);
}

async function storeWithCameraOn() {
  installTestMediaDevices([
    createTestMediaDevice("camera-1", "videoinput", "Studio Camera"),
  ]);
  const store = createMediaSessionStore();
  await store.getState().start();
  await store.getState().toggleSource("camera");
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useConnectionCheck", () => {
  it("checks the member's live tracks and reports each step, then the result", async () => {
    const microphone = createTestMediaTrack("audio", "mic-1");
    const { check, calls, finish } = deferredCheck();
    const { result } = renderConnectionCheck(check, microphone);

    expect(result.current.steps).toEqual({
      network: "pending",
      microphone: "pending",
      camera: "pending",
    });

    act(() => result.current.start());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.readTrack("microphone")).toBe(microphone);
    expect(calls[0]?.readTrack("camera")).toBeNull();
    expect(result.current.isRunning).toBe(true);

    act(() => calls[0]?.options.onStep("network", "passed"));
    expect(result.current.steps.network).toBe("passed");

    await act(async () => finish({ kind: "step-failed", step: "microphone" }));
    await waitFor(() =>
      expect(result.current.result).toEqual({
        kind: "step-failed",
        step: "microphone",
      }),
    );
    expect(result.current.isRunning).toBe(false);
  });

  it("ignores a second start while a check runs", async () => {
    const { check } = deferredCheck();
    const { result } = renderConnectionCheck(check);

    act(() => {
      result.current.start();
      result.current.start();
    });

    await waitFor(() => expect(check).toHaveBeenCalledOnce());
  });

  it("starts each run from pending steps", async () => {
    const { check, calls, finish } = deferredCheck();
    const { result } = renderConnectionCheck(check);

    act(() => result.current.start());
    await waitFor(() => expect(calls).toHaveLength(1));
    act(() => calls[0]?.options.onStep("network", "failed"));
    await act(async () => finish({ kind: "step-failed", step: "network" }));

    act(() => result.current.start());

    expect(result.current.steps.network).toBe("pending");
  });

  it("stops the check when the Join Gate unmounts", async () => {
    const { check, calls } = deferredCheck();
    const { result, unmount } = renderConnectionCheck(check);

    act(() => result.current.start());
    await waitFor(() => expect(calls).toHaveLength(1));
    unmount();

    expect(calls[0]?.options.signal?.aborted).toBe(true);
  });

  it("reads a check that crashed as failed", async () => {
    const check = vi.fn(async () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    const { result } = renderConnectionCheck(check);

    act(() => result.current.start());

    await waitFor(() =>
      expect(result.current.result).toEqual({ kind: "failed" }),
    );
  });

  it("skips a camera the member turns off while the check runs", async () => {
    const store = await storeWithCameraOn();
    expect(store.getState().camera.track).not.toBeNull();
    const probe = {
      network: vi.fn(async () => {
        await store.getState().toggleSource("camera");
        return true;
      }),
      publish: vi.fn(async () => true),
    };
    const { result } = renderWithStore(
      (readTrack, options) => runConnectionCheck(probe, readTrack, options),
      store,
    );

    act(() => result.current.start());

    await waitFor(() =>
      expect(result.current.result).toEqual({ kind: "passed" }),
    );
    expect(result.current.steps.camera).toBe("skipped");
    expect(probe.publish).not.toHaveBeenCalled();
  });
});
