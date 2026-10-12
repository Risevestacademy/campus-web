import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CampusOverview } from "./campus-overview";
import { CampusOverviewPanel } from "./campus-overview-panel";

describe("CampusOverviewPanel", () => {
  it("renders the collapse button passed in by the sidebar", () => {
    render(<CampusOverviewPanel collapseButton={<button>Collapse</button>} />);

    expect(screen.getByRole("button", { name: "Collapse" })).toBeVisible();
  });

  it("filters the roster as the participant is searched for", () => {
    render(<CampusOverviewPanel collapseButton={null} />);

    expect(screen.getByText("Victor")).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText("Search participants"), {
      target: { value: "ayo" },
    });

    expect(screen.getByText("Ayobami")).toBeVisible();
    expect(screen.queryByText("Victor")).not.toBeInTheDocument();
  });

  it("filters the roster by status", () => {
    render(<CampusOverviewPanel collapseButton={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Busy" }));

    expect(screen.getByText("Ramnan")).toBeVisible();
    expect(screen.queryByText("Victor")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All" }));

    expect(screen.getByText("Victor")).toBeVisible();
  });

  it("collapses the offline group independently from the online group", () => {
    render(<CampusOverviewPanel collapseButton={null} />);

    const onlineTrigger = screen.getByRole("button", { name: "Online 5" });
    const offlineTrigger = screen.getByRole("button", { name: "Offline 7" });

    expect(onlineTrigger).toHaveAttribute("aria-expanded", "true");
    expect(offlineTrigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(offlineTrigger);

    expect(offlineTrigger).toHaveAttribute("aria-expanded", "true");
    expect(onlineTrigger).toHaveAttribute("aria-expanded", "true");
  });

  it("renders injected participant, context, and offline state", () => {
    render(
      <CampusOverview
        collapseButton={null}
        contextLabel="Engineering · Mentor"
        offlineParticipantCount={3}
        participants={[
          {
            id: "zora",
            name: "Zora",
            initial: "Z",
            avatarClassName: "",
            status: "available",
            detail: "Available",
          },
        ]}
      />,
    );

    expect(screen.getByText("Engineering · Mentor")).toBeVisible();
    expect(screen.getByRole("button", { name: "Online 1" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Offline 3" })).toBeVisible();
    expect(screen.getByText("Zora")).toBeVisible();
  });

  it("reports participant and quick-transport intents", () => {
    const onParticipantAction = vi.fn();
    const onQuickTransport = vi.fn();

    render(
      <CampusOverview
        collapseButton={null}
        contextLabel="Engineering · Mentor"
        offlineParticipantCount={0}
        onParticipantAction={onParticipantAction}
        onQuickTransport={onQuickTransport}
        participants={[
          {
            id: "zora",
            name: "Zora",
            initial: "Z",
            avatarClassName: "",
            status: "available",
            detail: "Available",
          },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Wave Zora", hidden: true }),
    );
    fireEvent.click(screen.getByText("Now & next"));

    expect(onParticipantAction).toHaveBeenCalledWith(
      "wave",
      expect.objectContaining({ id: "zora" }),
    );
    expect(onQuickTransport).toHaveBeenCalledWith(
      expect.objectContaining({ id: "now-next" }),
    );
  });
});
