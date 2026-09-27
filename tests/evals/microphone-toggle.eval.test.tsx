import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VisualsDisplay } from "@/features/campus";

describe("microphone control UI (required threshold: 4/4)", () => {
  it("meets its composition and accessible-state criteria", () => {
    render(<VisualsDisplay />);

    const button = screen.getByRole("button", {
      name: "Mute microphone",
    });
    const initialStatePasses = button.getAttribute("aria-pressed") === "false";
    const compositionPasses =
      button.querySelectorAll("svg").length === 2 &&
      button.querySelector("[data-slot='microphone-enabled-icon']") !== null &&
      button.querySelector("[data-slot='microphone-disabled-icon']") !== null &&
      button.querySelector("line") === null;

    fireEvent.click(button);

    const mutedStatePasses =
      screen
        .getByRole("button", {
          name: "Unmute microphone",
        })
        .getAttribute("aria-pressed") === "true";

    fireEvent.click(button);

    const restoredStatePasses =
      screen
        .getByRole("button", {
          name: "Mute microphone",
        })
        .getAttribute("aria-pressed") === "false";

    const passedCriteria = [
      initialStatePasses,
      compositionPasses,
      mutedStatePasses,
      restoredStatePasses,
    ].filter(Boolean).length;

    expect(passedCriteria).toBe(4);
  });
});
