import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { MediaToggle } from "./media-toggle";

// A 220 Hz tone whose loudness swells twice a second, like someone talking,
// so the level fill can be judged without a real microphone.
function createSpeechLikeTrack() {
  const context = new AudioContext();
  const voice = context.createOscillator();
  const loudness = context.createGain();
  const swell = context.createOscillator();
  const swellDepth = context.createGain();
  const output = context.createMediaStreamDestination();

  voice.frequency.value = 220;
  loudness.gain.value = 0.05;
  swell.frequency.value = 2;
  swellDepth.gain.value = 0.05;
  swell.connect(swellDepth).connect(loudness.gain);
  voice.connect(loudness).connect(output);
  voice.start();
  swell.start();
  void context.resume();

  const [track] = output.stream.getAudioTracks();
  if (!track) throw new Error("The tone produced no audio track.");
  return track;
}

function SpeakingMicrophone() {
  const [track] = useState(createSpeechLikeTrack);
  const [isEnabled, setIsEnabled] = useState(true);

  return (
    <MediaToggle
      error={null}
      isEnabled={isEnabled}
      kind="microphone"
      levelTrack={track}
      onToggle={async () => setIsEnabled((enabled) => !enabled)}
      status="ready"
    />
  );
}

const meta = {
  title: "Features/Campus/MediaToggle",
  component: SpeakingMicrophone,
} satisfies Meta<typeof SpeakingMicrophone>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MicrophoneLevel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fill = () =>
      canvasElement.querySelector("[data-slot=microphone-level]");

    await expect(fill()).toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole("button", { name: "Turn off microphone" }),
    );

    await waitFor(() => expect(fill()).not.toBeInTheDocument());
  },
};
