import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import { ActiveCampus } from "./active-campus";
import { CampusShell } from "./campus-shell/campus-shell";

function OverviewPanelStub({ collapseButton }: { collapseButton: ReactNode }) {
  return <section aria-label="Overview panel">{collapseButton}</section>;
}

function AccountMenuStub({ children }: { children: ReactNode }) {
  return (
    <div role="group" aria-label="Account menu">
      {children}
    </div>
  );
}

function renderActiveCampus(AccountMenu?: typeof AccountMenuStub) {
  const store = createMediaSessionStore({ mediaDevices: null });

  return render(
    <CampusShell
      AccountMenu={AccountMenu}
      OverviewPanel={OverviewPanelStub}
      cohortId="c-1"
    >
      <MediaSessionProvider store={store}>
        <ActiveCampus>
          <p>Route content</p>
        </ActiveCampus>
      </MediaSessionProvider>
    </CampusShell>,
  );
}

function campusRail() {
  return screen.getByRole("navigation", { name: "Campus" });
}

afterEach(() => {
  window.localStorage.clear();
  Reflect.deleteProperty(document.documentElement.dataset, "sidebarOpen");
});

describe("ActiveCampus", () => {
  it("renders the route content alongside the campus controls", () => {
    renderActiveCampus();

    expect(screen.getByText("Route content")).toBeInTheDocument();
    expect(
      within(campusRail()).queryByRole("button", { name: "Administration" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Campus controls" }),
    ).toBeInTheDocument();
  });

  it("fills the map panel with the overview panel and its collapse button", () => {
    renderActiveCampus();

    const overview = screen.getByRole("region", { name: "Overview panel" });

    expect(
      within(overview).getByRole("button", { name: "Collapse sidebar" }),
    ).toBeInTheDocument();
  });

  it("shows every other rail panel as coming soon", () => {
    renderActiveCampus();

    const chat = within(campusRail()).getByRole("button", { name: "Chat" });

    fireEvent.click(chat);

    expect(chat).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "Chat" })).toBeInTheDocument();
    expect(screen.getByText("Coming soon.")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Overview panel" }),
    ).not.toBeInTheDocument();
  });

  it("switches the theme from the rail", () => {
    document.documentElement.dataset.theme = "light";
    renderActiveCampus();

    fireEvent.click(
      within(campusRail()).getByRole("button", { name: "Switch to dark mode" }),
    );

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("wraps the rail avatar in the account menu when given one", () => {
    renderActiveCampus(AccountMenuStub);

    const accountMenu = within(campusRail()).getByRole("group", {
      name: "Account menu",
    });

    expect(within(accountMenu).getByText("J")).toBeInTheDocument();
  });

  it("shows a plain rail avatar without an account menu", () => {
    renderActiveCampus();

    expect(within(campusRail()).getByText("J")).toBeInTheDocument();
    expect(
      within(campusRail()).queryByRole("group", { name: "Account menu" }),
    ).not.toBeInTheDocument();
  });
});
