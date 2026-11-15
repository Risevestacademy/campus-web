const SAMPLE_RATE = 44_100;
// Two rising notes, short enough not to startle and long enough to hear.
const NOTES = [
  { frequency: 660, seconds: 0.22 },
  { frequency: 880, seconds: 0.38 },
] as const;
const VOLUME = 0.3;

function writeText(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.codePointAt(index) ?? 0);
  }
}

function toneSamples(): Int16Array {
  const total = NOTES.reduce(
    (sum, note) => sum + Math.round(note.seconds * SAMPLE_RATE),
    0,
  );
  const samples = new Int16Array(total);
  let position = 0;

  for (const note of NOTES) {
    const length = Math.round(note.seconds * SAMPLE_RATE);
    for (let index = 0; index < length; index += 1) {
      // A quick attack and an exponential fade, so neither note clicks.
      const attack = Math.min(1, index / (0.01 * SAMPLE_RATE));
      const fade = Math.exp((-4 * index) / length);
      const wave = Math.sin(
        (2 * Math.PI * note.frequency * index) / SAMPLE_RATE,
      );
      samples[position + index] = Math.round(
        wave * attack * fade * VOLUME * 0x7f_ff,
      );
    }
    position += length;
  }

  return samples;
}

// A mono 16-bit PCM WAV of the test chime, built here so no audio file ships.
export function createTestToneWav(): Blob {
  const samples = toneSamples();
  const dataBytes = samples.length * 2;
  const view = new DataView(new ArrayBuffer(44 + dataBytes));

  writeText(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeText(view, 8, "WAVE");
  writeText(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(view, 36, "data");
  view.setUint32(40, dataBytes, true);
  samples.forEach((sample, index) => {
    view.setInt16(44 + index * 2, sample, true);
  });

  return new Blob([view.buffer], { type: "audio/wav" });
}
