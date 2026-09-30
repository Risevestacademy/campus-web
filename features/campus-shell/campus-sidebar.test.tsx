import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { TooltipProvider } from "@/shared/ui/tooltip";

import { CampusSidebar } from "./campus-sidebar";
import { SidebarCollapseButton } from "./sidebar-collapse-button";
import { SidebarReopenToggle } from "./sidebar-reopen-toggle";

beforeEach(() => {
  window.localStorage.clear();
  Reflect.deleteProperty(document.documentElement.dataset, "sidebarOpen");
});

function renderSidebar() {
  // Each real panel places its own `<SidebarCollapseButton />`; the "map"
  // panel here stands in for that.
  return render(
    <TooltipProvider>
      <CampusSidebar
        panels={{
          search: <p>Search panel</p>,
          map: (
            <>
              <p>Map panel</p>
              <SidebarCollapseButton />
            </>
          ),
          chat: <p>Chat panel</p>,
          tasks: <p>Tasks panel</p>,
          calendar: <p>Calendar panel</p>,
        }}
      />
      <SidebarReopenToggle />
    </TooltipProvider>,
  );
}

describe("CampusSidebar", () => {
  it("shows the active panel and hides the reopen toggle while open", () => {
    renderSidebar();

    expect(screen.getByText("Map panel")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Open sidebar" }),
    ).not.toBeInTheDocument();
  });

  it("collapses on request and can be reopened", () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(document.documentElement.dataset.sidebarOpen).toBe("false");
    expect(screen.getByRole("button", { name: "Open sidebar" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Open sidebar" }));

    expect(document.documentElement.dataset.sidebarOpen).toBe("true");
    expect(
      screen.queryByRole("button", { name: "Open sidebar" }),
    ).not.toBeInTheDocument();
  });
});
