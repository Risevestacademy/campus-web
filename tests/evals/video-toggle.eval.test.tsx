import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VisualsDisplay } from "@/features/campus";

describe("video control UI (required threshold: 4/4)", () => {
  it("meets its composition and accessible-state criteria", () => {
    render(<VisualsDisplay />);

    const button = screen.getByRole("button", {
      name: "Turn off camera",
    });
    const initialStatePasses = button.getAttribute("aria-pressed") === "false";
    const compositionPasses =
      button.querySelectorAll("svg").length === 2 &&
      button.querySelector("[data-slot='video-enabled-icon']") !== null &&
      button.querySelector("[data-slot='video-disabled-icon']") !== null &&
      button.querySelector("line") === null;

    fireEvent.click(button);

    const disabledStatePasses =
      screen
        .getByRole("button", {
          name: "Turn on camera",
        })
        .getAttribute("aria-pressed") === "true";

    fireEvent.click(button);

    const restoredStatePasses =
      screen
        .getByRole("button", {
          name: "Turn off camera",
        })
        .getAttribute("aria-pressed") === "false";

    const passedCriteria = [
      initialStatePasses,
      compositionPasses,
      disabledStatePasses,
      restoredStatePasses,
    ].filter(Boolean).length;

    expect(passedCriteria).toBe(4);
  });
});
