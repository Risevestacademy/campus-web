export type ConnectionCheckStep = "network" | "microphone" | "camera";

export type StepStatus =
  "pending" | "running" | "passed" | "failed" | "skipped";

export type ConnectionCheckRun =
  { kind: "passed" } | { kind: "step-failed"; step: ConnectionCheckStep };

export interface ConnectionCheckProbe {
  network(): Promise<boolean>;
  publish(track: MediaStreamTrack): Promise<boolean>;
}

export type PublishStep = Exclude<ConnectionCheckStep, "network">;

export type ReadTrack = (step: PublishStep) => MediaStreamTrack | null;

export interface ConnectionCheckRunOptions {
  onStep: (step: ConnectionCheckStep, status: StepStatus) => void;
  signal?: AbortSignal;
}

type StepProbe = () => Promise<boolean>;

// A track is read as its step starts: the member may turn a device off or
// switch it while earlier steps run, which ends the track read at the click.
function stepsFor(probe: ConnectionCheckProbe, readTrack: ReadTrack) {
  const publish = (step: PublishStep) => (): StepProbe | null => {
    const track = readTrack(step);
    return track?.readyState === "live" ? () => probe.publish(track) : null;
  };

  return [
    ["network", () => () => probe.network()],
    ["microphone", publish("microphone")],
    ["camera", publish("camera")],
  ] as const satisfies readonly (readonly [
    ConnectionCheckStep,
    () => StepProbe | null,
  ])[];
}

// The SDK cannot cancel a step in flight, so an abort lands between steps.
export async function runConnectionCheck(
  probe: ConnectionCheckProbe,
  readTrack: ReadTrack,
  { onStep, signal }: ConnectionCheckRunOptions,
): Promise<ConnectionCheckRun> {
  for (const [step, probeFor] of stepsFor(probe, readTrack)) {
    signal?.throwIfAborted();
    const check = probeFor();

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
