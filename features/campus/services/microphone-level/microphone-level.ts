// Speech sits roughly between these: quieter reads as empty, louder as full.
const FLOOR_DBFS = -55;
const CEILING_DBFS = -15;
// Per frame: about 300 ms from full to empty at 60 frames a second.
const RELEASE = 0.88;
// Two thresholds, so a level hovering at one never flickers the state.
const SPEAKING_ON = 0.25;
const SPEAKING_OFF = 0.15;

function rootMeanSquare(samples: Float32Array) {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

export function levelOf(samples: Float32Array): number {
  const dbfs = 20 * Math.log10(rootMeanSquare(samples));
  const level = (dbfs - FLOOR_DBFS) / (CEILING_DBFS - FLOOR_DBFS);
  return Math.min(1, Math.max(0, level));
}

export function nextDisplayedLevel(previous: number, measured: number) {
  return Math.max(measured, previous * RELEASE);
}

export function isSpeaking(wasSpeaking: boolean, level: number) {
  return wasSpeaking ? level > SPEAKING_OFF : level >= SPEAKING_ON;
}
