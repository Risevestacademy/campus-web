import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MeetingLockToggle } from "./meeting-lock-toggle";

describe("MeetingLockToggle", () => {
  it("toggles the meeting lock UI state", () => {
    render(<MeetingLockToggle />);

    const button = screen.getByRole("button", { name: "Meeting lock" });

    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAttribute("title", "Lock meeting");

    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("title", "Unlock meeting");

    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAttribute("title", "Lock meeting");
  });
});
