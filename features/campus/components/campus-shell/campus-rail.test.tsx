import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { AnalyticsConsentBanner } from "@/core/analytics/consent";

import { CampusShell } from "./campus-shell";

vi.mock("@/core/analytics/client", () => ({
  denyAnalyticsConsent: () => undefined,
  grantAnalyticsConsent: () => undefined,
  readAnalyticsConsent: () => Promise.resolve("denied"),
  watchAnalyticsConsent: () => () => undefined,
}));

function OverviewPanelStub({ collapseButton }: { collapseButton: ReactNode }) {
  return <section aria-label="Overview panel">{collapseButton}</section>;
}

function renderWithLogOut(action: { logOut: () => void; isPending: boolean }) {
  render(
    <CampusShell
      LogOutAction={({ children }) => children(action)}
      OverviewPanel={OverviewPanelStub}
      cohortId="c-1"
    >
      <p>Route content</p>
    </CampusShell>,
  );
}

describe("CampusRail", () => {
  it("asks before logging out, and logs out only once the visitor confirms", async () => {
    const logOut = vi.fn();
    renderWithLogOut({ logOut, isPending: false });

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Log out of Campus?",
    });
    expect(logOut).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Log out" }));

    expect(logOut).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("sends one log out when the visitor confirms again while the prompt closes", async () => {
    Element.prototype.getAnimations = () => [
      { finished: new Promise(() => {}) } as unknown as Animation,
    ];
    onTestFinished(() => {
      delete (Element.prototype as Partial<Element>).getAnimations;
    });
    const logOut = vi.fn();
    function PendingLogOutAction({
      children,
    }: {
      children: (action: {
        logOut: () => void;
        isPending: boolean;
      }) => ReactNode;
    }) {
      const [isPending, setIsPending] = useState(false);
      return children({
        logOut: () => {
          logOut();
          setIsPending(true);
        },
        isPending,
      });
    }
    render(
      <CampusShell
        LogOutAction={PendingLogOutAction}
        OverviewPanel={OverviewPanelStub}
        cohortId="c-1"
      >
        <p>Route content</p>
      </CampusShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Log out of Campus?",
    });
    const confirm = within(dialog).getByRole("button", { name: "Log out" });

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(logOut).toHaveBeenCalledOnce();
    expect(confirm).toBeInTheDocument();
    expect(confirm).toBeDisabled();
  });

  it("stays signed in when the visitor backs out of the prompt", async () => {
    const logOut = vi.fn();
    renderWithLogOut({ logOut, isPending: false });

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Stay signed in" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(logOut).not.toHaveBeenCalled();
  });

  it("shows Logging out… and disables the item while the request is in flight", () => {
    render(
      <CampusShell
        LogOutAction={({ children }) =>
          children({ logOut: vi.fn(), isPending: true })
        }
        OverviewPanel={OverviewPanelStub}
        cohortId="c-1"
      >
        <p>Route content</p>
      </CampusShell>,
    );

    const item = screen.getByRole("button", { name: "Logging out…" });
    fireEvent.click(item);

    expect(item).toHaveAttribute("aria-disabled", "true");
  });

  it("has no Log out item when the route passes no action", () => {
    render(
      <CampusShell OverviewPanel={OverviewPanelStub} cohortId="c-1">
        <p>Route content</p>
      </CampusShell>,
    );

    expect(screen.queryByRole("button", { name: "Log out" })).toBeNull();
  });

  it("offers Privacy choices to every member, account menu or not", async () => {
    render(
      <>
        <CampusShell OverviewPanel={OverviewPanelStub} cohortId="c-1">
          <p>Route content</p>
        </CampusShell>
        <AnalyticsConsentBanner />
      </>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Privacy choices" }),
    );

    expect(
      screen.getByRole("region", { name: "Analytics cookies" }),
    ).toHaveFocus();
  });
});

describe("CampusRail notifications", () => {
  function NotificationsPanelStub({
    cohortId,
    collapseButton,
  }: {
    cohortId: string;
    collapseButton: ReactNode;
  }) {
    return (
      <section aria-label="Notifications panel">
        For {cohortId}
        {collapseButton}
      </section>
    );
  }

  function renderWithNotifications(unread: number) {
    render(
      <CampusShell
        NotificationsPanel={NotificationsPanelStub}
        OverviewPanel={OverviewPanelStub}
        cohortId="c-1"
        useUnreadNotifications={() => unread}
      >
        <p>Route content</p>
      </CampusShell>,
    );
  }

  it("badges the Notifications item with how many are unread, and says so by name", () => {
    renderWithNotifications(3);

    const item = screen.getByRole("button", {
      name: "Notifications, 3 unread",
    });
    expect(within(item).getByText("3")).toBeVisible();
  });

  it("shows no badge when none are unread", () => {
    renderWithNotifications(0);

    const item = screen.getByRole("button", { name: "Notifications" });
    expect(within(item).queryByText("0")).not.toBeInTheDocument();
  });

  it("opens the route's panel for this cohort", async () => {
    renderWithNotifications(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Notifications, 1 unread" }),
    );

    expect(
      await screen.findByRole("region", { name: "Notifications panel" }),
    ).toHaveTextContent("For c-1");
  });

  it("has no Notifications item when the route passes no notifications", () => {
    render(
      <CampusShell OverviewPanel={OverviewPanelStub} cohortId="c-1">
        <p>Route content</p>
      </CampusShell>,
    );

    expect(
      screen.queryByRole("button", { name: /^Notifications/ }),
    ).not.toBeInTheDocument();
  });
});
