import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ActiveCampusLayout from "@/app/(app)/campus/[id]/(active-campus)/layout";
import CampusLayout from "@/app/(app)/campus/[id]/layout";

function renderActiveCampusLayout() {
  return render(
    <CampusLayout>
      <ActiveCampusLayout>
        <div />
      </ActiveCampusLayout>
    </CampusLayout>,
  );
}

describe("meeting view switch acceptance (required threshold: 3/3)", () => {
  it("controls the tile layout and backdrop through the active-campus layout", () => {
    renderActiveCampusLayout();

    const viewSwitch = screen.getByRole("switch", { name: "Use grid view" });

    expect(viewSwitch).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("button", {
        name: "Show expanded meeting view for Participant J",
      }),
    ).toBeInTheDocument();

    fireEvent.click(viewSwitch, { detail: 1 });

    expect(viewSwitch).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("meeting-view-backdrop")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Focus Participant J" }),
    ).toBeInTheDocument();
  });

  it("expands the meeting view when a compact tile is activated", () => {
    renderActiveCampusLayout();

    const viewSwitch = screen.getByRole("switch", { name: "Use grid view" });
    const participantTile = screen.getByRole("button", {
      name: "Show expanded meeting view for Participant J",
    });

    fireEvent.click(participantTile, { detail: 1 });

    expect(viewSwitch).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("meeting-view-backdrop")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Focus Participant J" }),
    ).toBeInTheDocument();
  });

  it("promotes an expanded tile and moves the other tile to secondary emphasis", () => {
    renderActiveCampusLayout();

    fireEvent.click(screen.getByRole("switch", { name: "Use grid view" }), {
      detail: 1,
    });

    const participantA = screen.getByRole("button", {
      name: "Focus Participant A",
    });
    const participantJ = screen.getByRole("button", {
      name: "Focus Participant J",
    });

    fireEvent.click(participantA, { detail: 1 });

    expect(participantA).toHaveAttribute("aria-pressed", "true");
    expect(participantA).toHaveAccessibleName("Restore equal meeting view");
    expect(participantJ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(participantJ, { detail: 1 });

    expect(participantA).toHaveAttribute("aria-pressed", "false");
    expect(participantJ).toHaveAttribute("aria-pressed", "true");
    expect(participantJ).toHaveAccessibleName("Restore equal meeting view");
  });
});
