export type ConnectionCheckStep = "network" | "microphone" | "camera";

export type StepStatus =
  "pending" | "running" | "passed" | "failed" | "skipped";

export type ConnectionCheckRun =
  { kind: "passed" } | { kind: "step-failed"; step: ConnectionCheckStep };

export interface ConnectionCheckProbe {
  network(): Promise<boolean>;
  publish(track: MediaStreamTrack): Promise<boolean>;
}

export type LiveTracks = Readonly<{
  microphone: MediaStreamTrack | null;
  camera: MediaStreamTrack | null;
}>;

export interface ConnectionCheckRunOptions {
  onStep: (step: ConnectionCheckStep, status: StepStatus) => void;
  signal?: AbortSignal;
}

type StepProbe = (() => Promise<boolean>) | null;

function stepsFor(probe: ConnectionCheckProbe, tracks: LiveTracks) {
  const publish = (track: MediaStreamTrack | null): StepProbe =>
    track ? () => probe.publish(track) : null;

  return [
    ["network", () => probe.network()],
    ["microphone", publish(tracks.microphone)],
    ["camera", publish(tracks.camera)],
  ] as const satisfies readonly (readonly [ConnectionCheckStep, StepProbe])[];
}

// The SDK cannot cancel a step in flight, so an abort lands between steps.
export async function runConnectionCheck(
  probe: ConnectionCheckProbe,
  tracks: LiveTracks,
  { onStep, signal }: ConnectionCheckRunOptions,
): Promise<ConnectionCheckRun> {
  for (const [step, check] of stepsFor(probe, tracks)) {
    signal?.throwIfAborted();

    if (!check) {
      onStep(step, "skipped");
      continue;
    }

    onStep(step, "running");
    const passed = await check();
    signal?.throwIfAborted();
    onStep(step, passed ? "passed" : "failed");

    if (!passed) {
      return { kind: "step-failed", step };
    }
  }

  return { kind: "passed" };
}
