import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ActiveCampusLayout from "@/app/(app)/campus/[id]/(active-campus)/layout";

describe("campus control bar acceptance (required threshold: 1/1)", () => {
  it("exposes the complete desktop control bar through the active-campus layout", () => {
    render(
      <ActiveCampusLayout>
        <div />
      </ActiveCampusLayout>,
    );

    const controls = screen.getByRole("complementary", {
      name: "Campus controls",
    });

    expect(
      within(controls).getByRole("button", {
        name: "Open presence settings. Current status: Active",
      }),
    ).toBeInTheDocument();
    expect(
      within(controls).getByRole("group", { name: "Camera controls" }),
    ).toBeInTheDocument();
    expect(
      within(controls).getByRole("group", { name: "Microphone controls" }),
    ).toBeInTheDocument();
    expect(
      within(controls).getByRole("group", { name: "Campus actions" }),
    ).toBeInTheDocument();
    expect(
      within(controls).getByRole("link", { name: "Back to campuses" }),
    ).toHaveAttribute("href", "/campus");
    expect(
      within(controls).getByRole("group", { name: "Zoom controls" }),
    ).toHaveAttribute("data-orientation", "vertical");
  });
});
