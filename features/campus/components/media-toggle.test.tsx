import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MediaToggle } from "./media-toggle";

describe("MediaToggle", () => {
  it.each([
    {
      disabledSlot: "video-disabled-icon",
      disableTitle: "Turn off camera",
      enabledSlot: "video-enabled-icon",
      enableTitle: "Turn on camera",
      kind: "video" as const,
      label: "Camera",
    },
    {
      disabledSlot: "microphone-disabled-icon",
      disableTitle: "Mute microphone",
      enabledSlot: "microphone-enabled-icon",
      enableTitle: "Unmute microphone",
      kind: "microphone" as const,
      label: "Microphone",
    },
  ])(
    "toggles the $label UI while keeping its accessible name stable",
    ({ disabledSlot, disableTitle, enabledSlot, enableTitle, kind, label }) => {
      render(<MediaToggle kind={kind} />);

      const button = screen.getByRole("button", { name: label });

      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(button).toHaveAttribute("title", disableTitle);
      expect(
        button.querySelector(`[data-slot="${enabledSlot}"]`),
      ).toBeInTheDocument();
      expect(
        button.querySelector(`[data-slot="${disabledSlot}"]`),
      ).toBeInTheDocument();

      fireEvent.click(button);

      expect(button).toHaveAttribute("aria-pressed", "false");
      expect(button).toHaveAttribute("title", enableTitle);

      fireEvent.click(button);

      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(button).toHaveAttribute("title", disableTitle);
    },
  );
});
