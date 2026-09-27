import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VisualsDisplay } from "./visuals-display";

describe("VisualsDisplay", () => {
  it.each([
    {
      disabledSlot: "video-disabled-icon",
      enabledSlot: "video-enabled-icon",
      label: "Turn off camera",
    },
    {
      disabledSlot: "microphone-disabled-icon",
      enabledSlot: "microphone-enabled-icon",
      label: "Mute microphone",
    },
  ])(
    "renders dedicated Phosphor glyphs for $label",
    ({ disabledSlot, enabledSlot, label }) => {
      render(<VisualsDisplay />);

      const button = screen.getByRole("button", { name: label });

      expect(button.querySelectorAll("svg")).toHaveLength(2);
      expect(
        button.querySelector(`[data-slot="${enabledSlot}"]`),
      ).toBeInTheDocument();
      expect(
        button.querySelector(`[data-slot="${disabledSlot}"]`),
      ).toBeInTheDocument();
      expect(button.querySelector("line")).not.toBeInTheDocument();
    },
  );

  it("keeps the camera and microphone UI states independent", () => {
    render(<VisualsDisplay />);

    const cameraButton = screen.getByRole("button", {
      name: "Turn off camera",
    });
    const microphoneButton = screen.getByRole("button", {
      name: "Mute microphone",
    });

    fireEvent.click(cameraButton);

    expect(
      screen.getByRole("button", { name: "Mute microphone" }),
    ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(microphoneButton);

    expect(
      screen.getByRole("button", { name: "Turn on camera" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Unmute microphone" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles the camera's off UI state", () => {
    render(<VisualsDisplay />);

    const turnOffButton = screen.getByRole("button", {
      name: "Turn off camera",
    });

    expect(turnOffButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(turnOffButton);

    const turnOnButton = screen.getByRole("button", {
      name: "Turn on camera",
    });

    expect(turnOnButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(turnOnButton);

    expect(
      screen.getByRole("button", { name: "Turn off camera" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles the microphone's muted UI state", () => {
    render(<VisualsDisplay />);

    const muteButton = screen.getByRole("button", {
      name: "Mute microphone",
    });

    expect(muteButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(muteButton);

    const unmuteButton = screen.getByRole("button", {
      name: "Unmute microphone",
    });

    expect(unmuteButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(unmuteButton);

    expect(
      screen.getByRole("button", { name: "Mute microphone" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
