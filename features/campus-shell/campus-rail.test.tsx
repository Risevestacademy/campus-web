import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { TooltipProvider } from "@/shared/ui/tooltip";

import { CampusRail } from "./campus-rail";
import { SHELL_STORAGE_KEY } from "./shell-preferences";

beforeEach(() => {
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
});
