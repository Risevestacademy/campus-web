import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { TooltipProvider } from "@/shared/ui/tooltip";

import { CampusSidebar } from "./campus-sidebar";
import { setSidebarOpen } from "./shell-store";
import { SidebarCollapseButton } from "./sidebar-collapse-button";

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
    </TooltipProvider>,
  );
}

describe("CampusSidebar", () => {
  it("shows the active panel while open", () => {
    renderSidebar();

    expect(screen.getByText("Map panel")).toBeVisible();
  });

  it("collapses on request and reopens when the store is told to", () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(document.documentElement.dataset.sidebarOpen).toBe("false");

    act(() => setSidebarOpen(true));

    expect(document.documentElement.dataset.sidebarOpen).toBe("true");
    expect(screen.getByText("Map panel")).toBeVisible();
  });
});
