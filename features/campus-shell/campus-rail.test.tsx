import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { TooltipProvider } from "@/shared/ui/tooltip";

import { CampusRail } from "./campus-rail";
import { SHELL_STORAGE_KEY } from "./shell-preferences";

beforeEach(() => {
  document.documentElement.dataset.theme = "light";
  window.localStorage.clear();
});

describe("CampusRail", () => {
  it("marks the active panel and switches it on click", () => {
    render(
      <TooltipProvider>
        <CampusRail />
      </TooltipProvider>,
    );

    const mapButton = screen.getByRole("button", { name: "Campus overview" });
    const chatButton = screen.getByRole("button", { name: "Chat" });

    expect(mapButton).toHaveAttribute("aria-current", "page");
    expect(chatButton).not.toHaveAttribute("aria-current");

    fireEvent.click(chatButton);

    expect(chatButton).toHaveAttribute("aria-current", "page");
    expect(mapButton).not.toHaveAttribute("aria-current");
    expect(
      JSON.parse(window.localStorage.getItem(SHELL_STORAGE_KEY) ?? "{}"),
    ).toMatchObject({ activePanel: "chat" });
  });

  it("shows the chat badge count", () => {
    render(
      <TooltipProvider>
        <CampusRail />
      </TooltipProvider>,
    );

    expect(screen.getByRole("button", { name: "Chat" })).toHaveTextContent("3");
  });

  it("ends with the viewer's avatar by default", () => {
    render(
      <TooltipProvider>
        <CampusRail />
      </TooltipProvider>,
    );

    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("puts the account slot where the avatar would be", () => {
    render(
      <TooltipProvider>
        <CampusRail account={<button type="button">Account</button>} />
      </TooltipProvider>,
    );

    expect(screen.getByRole("button", { name: "Account" })).toBeInTheDocument();
    expect(screen.queryByText("J")).not.toBeInTheDocument();
  });

  it("hosts the theme switch, so nothing floats over the account slot", () => {
    render(
      <TooltipProvider>
        <CampusRail />
      </TooltipProvider>,
    );

    const rail = screen.getByRole("navigation", { name: "Campus" });
    fireEvent.click(
      within(rail).getByRole("button", { name: "Switch to dark mode" }),
    );

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(
      within(rail).getByRole("button", { name: "Switch to light mode" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(rail).toHaveAttribute("data-theme-toggle-host");
  });
});
