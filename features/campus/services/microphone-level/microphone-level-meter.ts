import { isSpeaking, levelOf, nextDisplayedLevel } from "./microphone-level";

export type LevelAnalyser = Readonly<{
  read: (samples: Float32Array<ArrayBuffer>) => void;
  release: () => void;
  size: number;
}>;

type MicrophoneLevelMeterPorts = Readonly<{
  cancelFrame: (id: number) => void;
  // Undefined where the browser cannot analyse audio: the mic just shows no level.
  createAnalyser: (track: MediaStreamTrack) => LevelAnalyser | undefined;
  requestFrame: (callback: FrameRequestCallback) => number;
}>;

export type RenderLevel = (level: number, speaking: boolean) => void;

export type MicrophoneLevelMeter = Readonly<{
  follow: (track: MediaStreamTrack, render: RenderLevel) => () => void;
}>;

export function createMicrophoneLevelMeter({
  cancelFrame,
  createAnalyser,
  requestFrame,
}: MicrophoneLevelMeterPorts): MicrophoneLevelMeter {
  function readEveryFrame(analyser: LevelAnalyser, render: RenderLevel) {
    const samples = new Float32Array(analyser.size);
    let level = 0;
    let speaking = false;

    function readFrame() {
      analyser.read(samples);
      level = nextDisplayedLevel(level, levelOf(samples));
      speaking = isSpeaking(speaking, level);
      render(level, speaking);
      frame = requestFrame(readFrame);
    }

    let frame = requestFrame(readFrame);

    return () => {
      cancelFrame(frame);
      analyser.release();
    };
  }

  return {
    follow(track, render) {
      const analyser = createAnalyser(track);
      return analyser ? readEveryFrame(analyser, render) : () => undefined;
    },
  };
}
