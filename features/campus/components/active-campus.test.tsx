import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import { WorldSessionProvider } from "../services/world-session/world-session-provider";
import {
  createTestWorldSession,
  type TestWorldSession,
} from "../testing/world-session-test-utils";
import { ActiveCampus } from "./active-campus";
import { CampusShell } from "./campus-shell/campus-shell";

const activeCampusViewModel = {
  meeting: {
    localParticipantId: "participant-a",
    participants: [
      { id: "participant-a", initials: "A", name: "Ada Lovelace" },
      { id: "participant-j", initials: "J", name: "James Baldwin" },
    ],
    remainingParticipantCount: 0,
    title: "Design review",
  },
  viewer: { initials: "AL", presenceStatus: "active" },
} as const;

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

function renderActiveCampus(
  AccountMenu?: typeof AccountMenuStub,
  world: TestWorldSession = createTestWorldSession(),
) {
  const store = createMediaSessionStore({ mediaDevices: null });

  return render(
    <CampusShell
      AccountMenu={AccountMenu}
      OverviewPanel={OverviewPanelStub}
      cohortId="c-1"
    >
      <MediaSessionProvider store={store}>
        <WorldSessionProvider world={world}>
          <ActiveCampus
            viewModel={activeCampusViewModel}
            zoomControls={<div role="group" aria-label="Zoom controls" />}
          >
            <p>Route content</p>
          </ActiveCampus>
        </WorldSessionProvider>
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

  it("returns from grid view to map view before opening the sidebar", () => {
    renderActiveCampus();

    const viewSwitch = screen.getByRole("switch", { name: "Use grid view" });

    fireEvent.click(viewSwitch);
    fireEvent.click(screen.getByRole("button", { name: "Open sidebar" }));

    expect(viewSwitch).toHaveAttribute("aria-checked", "false");
    expect(document.documentElement.dataset.sidebarOpen).toBe("true");
  });

  it("clears focused-participant view before opening the sidebar", () => {
    renderActiveCampus();

    fireEvent.click(screen.getByRole("switch", { name: "Use grid view" }));
    fireEvent.click(screen.getByRole("button", { name: "Focus Ada Lovelace" }));
    fireEvent.click(screen.getByRole("button", { name: "Open sidebar" }));

    expect(
      screen.queryByRole("button", { name: "Restore equal meeting view" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Show expanded meeting view for Ada Lovelace",
      }),
    ).toBeInTheDocument();
  });
});

function FeedbackPopupStub({
  isOpen,
  onClose,
  viewer,
}: {
  isOpen: boolean;
  onClose: () => void;
  viewer?: { id: string; displayName?: string | null };
}) {
  return isOpen ? (
    <section aria-label="Feedback popup">
      <p>{viewer?.displayName}</p>
      <button type="button" onClick={onClose}>
        Close popup
      </button>
    </section>
  ) : null;
}

describe("Feedback popup", () => {
  it("opens from the Report an issue rail button and closes again", () => {
    render(
      <CampusShell
        FeedbackPopup={FeedbackPopupStub}
        OverviewPanel={OverviewPanelStub}
        cohortId="c-1"
        viewer={{ id: "u-1", displayName: "Joseph Okoro" }}
      >
        <p>Route content</p>
      </CampusShell>,
    );

    expect(
      screen.queryByRole("region", { name: "Feedback popup" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(campusRail()).getByRole("button", { name: "Report an issue" }),
    );

    const popup = screen.getByRole("region", { name: "Feedback popup" });

    expect(within(popup).getByText("Joseph Okoro")).toBeInTheDocument();
    expect(screen.getByText("Route content")).toBeInTheDocument();

    fireEvent.click(within(popup).getByRole("button", { name: "Close popup" }));

    expect(
      screen.queryByRole("region", { name: "Feedback popup" }),
    ).not.toBeInTheDocument();
  });

  describe("closing the feedback popup from the rest of the shell", () => {
    function renderWithPopup() {
      render(
        <CampusShell
          FeedbackPopup={FeedbackPopupStub}
          OverviewPanel={OverviewPanelStub}
          cohortId="c-1"
          viewer={{ id: "u-1", displayName: "Joseph Okoro" }}
        >
          <p>Route content</p>
        </CampusShell>,
      );
      fireEvent.click(
        within(campusRail()).getByRole("button", { name: "Report an issue" }),
      );
      expect(
        screen.getByRole("region", { name: "Feedback popup" }),
      ).toBeInTheDocument();
    }

    it("closes when another rail button is used", () => {
      renderWithPopup();

      fireEvent.click(
        within(campusRail()).getByRole("button", { name: "Search" }),
      );

      expect(
        screen.queryByRole("region", { name: "Feedback popup" }),
      ).not.toBeInTheDocument();
    });

    it("closes when something in the sidebar is used", () => {
      renderWithPopup();

      fireEvent.click(
        within(
          screen.getByRole("region", { name: "Overview panel" }),
        ).getByRole("button"),
      );

      expect(
        screen.queryByRole("region", { name: "Feedback popup" }),
      ).not.toBeInTheDocument();
    });

    it("stays open when Report an issue is pressed again", () => {
      renderWithPopup();

      fireEvent.click(
        within(campusRail()).getByRole("button", { name: "Report an issue" }),
      );

      expect(
        screen.getByRole("region", { name: "Feedback popup" }),
      ).toBeInTheDocument();
    });

    it("stays open when the popup itself is used", () => {
      renderWithPopup();

      fireEvent.click(screen.getByText("Joseph Okoro"));

      expect(
        screen.getByRole("region", { name: "Feedback popup" }),
      ).toBeInTheDocument();
    });
  });

  it("tells the member when the campus map has lost world", () => {
    renderActiveCampus(
      undefined,
      createTestWorldSession({ phase: "closed", outcome: "gave-up" }),
    );

    expect(
      screen.getByRole("button", { name: "Reconnect" }),
    ).toBeInTheDocument();
  });
});
