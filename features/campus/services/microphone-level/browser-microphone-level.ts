import {
  createMicrophoneLevelMeter,
  type LevelAnalyser,
} from "./microphone-level-meter";

const ANALYSER_FFT_SIZE = 512;

// One context for the document: browsers cap how many may run at once.
let audioContext: AudioContext | undefined;

function sharedAudioContext() {
  audioContext ??= new AudioContext();
  void audioContext.resume().catch(() => undefined);
  return audioContext;
}

// Never connected to the destination: metering must not play the member's
// own voice back to them.
function connectAnalyser(track: MediaStreamTrack): LevelAnalyser {
  const context = sharedAudioContext();
  const source = context.createMediaStreamSource(new MediaStream([track]));
  const analyser = context.createAnalyser();
  analyser.fftSize = ANALYSER_FFT_SIZE;
  source.connect(analyser);

  return {
    read: (samples) => analyser.getFloatTimeDomainData(samples),
    release() {
      source.disconnect();
      analyser.disconnect();
    },
    size: analyser.fftSize,
  };
}

// No Web Audio, or a browser that refuses another context: the mic shows no
// level rather than taking the media controls down with it.
function createBrowserAnalyser(
  track: MediaStreamTrack,
): LevelAnalyser | undefined {
  try {
    return connectAnalyser(track);
  } catch {
    return undefined;
  }
}

export const browserMicrophoneLevelMeter = createMicrophoneLevelMeter({
  cancelFrame: (id) => cancelAnimationFrame(id),
  createAnalyser: createBrowserAnalyser,
  requestFrame: (callback) => requestAnimationFrame(callback),
});
