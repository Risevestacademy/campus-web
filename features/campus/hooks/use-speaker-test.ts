import { useRef, useState } from "react";

import { useMountEffect } from "@/shared/lib/use-mount-effect";

import { createTestToneWav } from "../services/speaker-test/test-tone";

type SinkableAudio = HTMLAudioElement & {
  setSinkId?: (deviceId: string) => Promise<void>;
};

export type SpeakerTestStatus = "idle" | "playing" | "failed";

// Plays the test chime through the chosen speaker. Browsers that cannot pick
// an output play it through the system default, which is what they use for
// the call too.
export function useSpeakerTest(outputDeviceId: string) {
  const [status, setStatus] = useState<SpeakerTestStatus>("idle");
  const audio = useRef<SinkableAudio | null>(null);
  const toneUrl = useRef<string | null>(null);

  function release() {
    audio.current?.pause();
    audio.current = null;
    if (toneUrl.current) URL.revokeObjectURL(toneUrl.current);
    toneUrl.current = null;
  }

  async function play() {
    release();
    toneUrl.current = URL.createObjectURL(createTestToneWav());
    const element: SinkableAudio = new Audio(toneUrl.current);
    audio.current = element;
    setStatus("playing");

    element.addEventListener("ended", () => {
      if (audio.current !== element) return;
      release();
      setStatus("idle");
    });

    try {
      if (outputDeviceId && element.setSinkId) {
        await element.setSinkId(outputDeviceId);
      }
      await element.play();
    } catch {
      if (audio.current !== element) return;
      release();
      setStatus("failed");
    }
  }

  useMountEffect(() => release);

  return { status, play: () => void play() };
}
