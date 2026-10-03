import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CampusMediaSessionProvider } from "@/features/campus";
import { activeCampusLayout } from "@/tests/fixtures/active-campus-layout";

vi.mock("@/features/auth", () => import("@/tests/fixtures/route-access-stub"));

describe("campus control bar acceptance (required threshold: 1/1)", () => {
  it("exposes the complete desktop control bar through the active-campus layout", async () => {
    render(
      <CampusMediaSessionProvider>
        {await activeCampusLayout()}
      </CampusMediaSessionProvider>,
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
