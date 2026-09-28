import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AudioSettingsDropdown } from "@/features/campus/components/audio-settings-dropdown";
import { CameraSettingsDropdown } from "@/features/campus/components/camera-settings-dropdown";

describe("media settings trigger press feedback (required threshold: 2/2)", () => {
  it("keeps camera and audio triggers responsive and reduced-motion safe", () => {
    render(
      <>
        <CameraSettingsDropdown />
        <AudioSettingsDropdown />
      </>,
    );

    const triggers = [
      screen.getByRole("button", { name: "Open camera settings" }),
      screen.getByRole("button", { name: "Open audio settings" }),
    ];

    const passedCriteria = triggers.filter(
      (trigger) =>
        trigger.classList.contains("active:aria-[haspopup]:scale-[0.97]") &&
        trigger.classList.contains(
          "motion-reduce:active:aria-[haspopup]:scale-100",
        ),
    ).length;

    expect(passedCriteria).toBe(2);
  });
});
