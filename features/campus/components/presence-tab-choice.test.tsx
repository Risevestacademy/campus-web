import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PresenceTabChoice } from "./presence-tab-choice";

describe("PresenceTabChoice", () => {
  it("tells a second tab the cohort is joined elsewhere", () => {
    render(<PresenceTabChoice onUseHere={vi.fn()} status="elsewhere" />);

    expect(
      screen.getByRole("heading", {
        name: "You're in this cohort in another tab",
      }),
    ).toBeVisible();
  });

  it("tells a taken-over tab the session moved", () => {
    render(<PresenceTabChoice onUseHere={vi.fn()} status="taken-over" />);

    expect(
      screen.getByRole("heading", { name: "You joined from another tab" }),
    ).toBeVisible();
  });

  it("leads back to the campuses", () => {
    render(<PresenceTabChoice onUseHere={vi.fn()} status="elsewhere" />);

    expect(
      screen.getByRole("link", { name: "Back to campuses" }),
    ).toHaveAttribute("href", "/campus");
  });

  it("moves the session once while the move is pending", () => {
    const onUseHere = vi.fn(() => new Promise<void>(() => {}));
    render(<PresenceTabChoice onUseHere={onUseHere} status="elsewhere" />);

    fireEvent.click(screen.getByRole("button", { name: "Use here" }));
    const pendingButton = screen.getByRole("button", { name: "Moving…" });
    fireEvent.click(pendingButton);

    expect(pendingButton).toBeDisabled();
    expect(onUseHere).toHaveBeenCalledOnce();
  });
});
