import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CampusMediaSessionProvider } from "@/features/campus";
import { activeCampusLayout } from "@/tests/fixtures/active-campus-layout";

vi.mock("@/features/auth", () => import("@/tests/fixtures/route-access-stub"));

async function renderActiveCampusLayout() {
  return render(
    <CampusMediaSessionProvider>
      {await activeCampusLayout()}
    </CampusMediaSessionProvider>,
  );
}

afterEach(() => {
  window.localStorage.clear();
  Reflect.deleteProperty(document.documentElement.dataset, "sidebarOpen");
});

describe("meeting view switch acceptance (required threshold: 4/4)", () => {
  it("controls the tile layout and backdrop through the active-campus layout", async () => {
    await renderActiveCampusLayout();

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

  it("expands the meeting view when a compact tile is activated", async () => {
    await renderActiveCampusLayout();

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

  it("promotes an expanded tile and moves the other tile to secondary emphasis", async () => {
    await renderActiveCampusLayout();

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

  it("collapses the sidebar for grid view and returns to the map when it reopens", async () => {
    await renderActiveCampusLayout();

    const viewSwitch = screen.getByRole("switch", { name: "Use grid view" });

    fireEvent.click(viewSwitch, { detail: 1 });

    expect(document.documentElement.dataset.sidebarOpen).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Open sidebar" }));

    expect(document.documentElement.dataset.sidebarOpen).toBe("true");
    expect(viewSwitch).toHaveAttribute("aria-checked", "false");
  });
});
