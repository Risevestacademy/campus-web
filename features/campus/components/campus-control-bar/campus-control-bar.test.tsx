import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CampusControlBar } from "./campus-control-bar";

describe("CampusControlBar", () => {
  it("composes accessible campus controls from explicit presence data", () => {
    render(<CampusControlBar initials="AJ" status="active" />);

    expect(
      screen.getByRole("button", {
        name: "Open presence settings. Current status: Active",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("AJ")).toBeInTheDocument();

    expect(
      screen.getByRole("group", { name: "Camera controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Microphone controls" }),
    ).toBeInTheDocument();

    const campusActions = screen.getByRole("group", {
      name: "Campus actions",
    });
    expect(
      within(campusActions).getByRole("button", { name: "Share screen" }),
    ).toBeInTheDocument();
    expect(
      within(campusActions).getByRole("button", { name: "Open chat" }),
    ).toBeInTheDocument();
    expect(
      within(campusActions).getByRole("button", { name: "Raise hand" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "Back to campuses" }),
    ).toHaveAttribute("href", "/campus");

    const zoomControls = screen.getByRole("group", { name: "Zoom controls" });
    expect(zoomControls).toHaveAttribute("data-orientation", "vertical");
    expect(
      within(zoomControls).getByRole("button", { name: "Zoom in" }),
    ).toBeInTheDocument();
    expect(
      within(zoomControls).getByRole("button", { name: "Zoom out" }),
    ).toBeInTheDocument();
  });
});
