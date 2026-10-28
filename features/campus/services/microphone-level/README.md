# Microphone level

How loud the member's own microphone is, for the fill inside the mic glyph
(`MediaToggle`). Pre-join, the control bar and the Presence Dock all show it,
so a member can see they are heard before anyone answers.

## Interface

```ts
const stop = browserMicrophoneLevelMeter.follow(track, (level, speaking) => {
  // level 0..1 every animation frame; speaking with hysteresis
});
```

`useMicrophoneLevelRef(track)` (hooks/) attaches it to an element: it writes
`--mic-level` and `data-speaking` straight to the DOM, never React state.

## Modules

| Module                        | Owns                                                      |
| ----------------------------- | --------------------------------------------------------- |
| `microphone-level.ts`         | RMS to dBFS to 0..1, smoothing and the speaking threshold |
| `microphone-level-meter.ts`   | one analyser read per animation frame, and its cleanup    |
| `browser-microphone-level.ts` | the shared `AudioContext` and `AnalyserNode` ports        |

## Rules

- -55 dBFS reads as empty and -15 dBFS as full. The level rises at once and
  falls by 12% a frame, about 300 ms from full to empty.
- One `AudioContext` for the document. The analyser never connects to the
  speakers, so metering never plays the member's voice back.
- No meter while the microphone is off: turning it off stops the track.
- Where the browser cannot analyse audio, the glyph shows no level.
- Reduced motion: no fill (a growing shape is motion under WCAG 2.3.3); the
  glyph turns green while speaking instead (colour only).
- Not LiveKit's `createAudioAnalyser`: it needs the SDK, which pre-join must
  not load, and its -100 to -80 dB default window pins speech at full.

## Tests

```bash
pnpm vitest run --project=unit \
  features/campus/services/microphone-level \
  features/campus/hooks/use-microphone-level-ref.test.tsx \
  features/campus/components/media-toggle.test.tsx
```

Tune the window and release in Storybook: Features/Campus/MediaToggle.
