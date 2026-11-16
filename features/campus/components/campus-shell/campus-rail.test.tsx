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
import type { OwnProfileActionComponent } from "./rail-account";

vi.mock("@/core/analytics/client", () => ({
  denyAnalyticsConsent: () => undefined,
  grantAnalyticsConsent: () => undefined,
  readAnalyticsConsent: () => Promise.resolve("denied"),
  watchAnalyticsConsent: () => () => undefined,
}));

function OverviewPanelStub({ collapseButton }: { collapseButton: ReactNode }) {
  return <section aria-label="Overview panel">{collapseButton}</section>;
}

const VIEWER = { id: "u-1", displayName: "Ada Lovelace" };

function renderWithLogOut(action: { logOut: () => void; isPending: boolean }) {
  render(
    <CampusShell
      LogOutAction={({ children }) => children(action)}
      OverviewPanel={OverviewPanelStub}
      cohortId="c-1"
      viewer={VIEWER}
    >
      <p>Route content</p>
    </CampusShell>,
  );
}

async function openAccount(name = "Ada Lovelace") {
  fireEvent.click(screen.getByRole("button", { name: /^Your account/ }));
  return screen.findByRole("dialog", { name });
}

async function chooseLogOut() {
  const account = await openAccount();
  fireEvent.click(within(account).getByRole("button", { name: "Log out" }));
  return screen.findByRole("dialog", { name: "Log out of Campus?" });
}

describe("CampusRail", () => {
  it("asks before logging out, and logs out only once the visitor confirms", async () => {
    const logOut = vi.fn();
    renderWithLogOut({ logOut, isPending: false });

    const dialog = await chooseLogOut();
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
        viewer={VIEWER}
      >
        <p>Route content</p>
      </CampusShell>,
    );

    const dialog = await chooseLogOut();
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

    await chooseLogOut();
    fireEvent.click(
      await screen.findByRole("button", { name: "Stay signed in" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(logOut).not.toHaveBeenCalled();
  });

  it("shows Logging out… and disables the item while the request is in flight", async () => {
    renderWithLogOut({ logOut: vi.fn(), isPending: true });

    const account = await openAccount();

    expect(
      within(account).getByRole("button", { name: "Logging out…" }),
    ).toBeDisabled();
  });

  it("has no Log out item when the route passes no action", async () => {
    render(
      <CampusShell
        OverviewPanel={OverviewPanelStub}
        cohortId="c-1"
        viewer={VIEWER}
      >
        <p>Route content</p>
      </CampusShell>,
    );

    const account = await openAccount();

    expect(
      within(account).queryByRole("button", { name: "Log out" }),
    ).toBeNull();
  });

  it("keeps Log out out of the rail itself", () => {
    renderWithLogOut({ logOut: vi.fn(), isPending: false });

    expect(
      within(screen.getByRole("navigation", { name: "Campus" })).queryByRole(
        "button",
        { name: "Log out" },
      ),
    ).toBeNull();
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

  describe("account menu", () => {
    function renderWithProfile(
      summary = {
        avatarUrl: null,
        displayName: "Ada L.",
        email: "ada@campus.local",
        place: "Backend · Cohort 2026",
      },
    ) {
      const openEditor = vi.fn();
      const OwnProfileAction: OwnProfileActionComponent = ({ children }) =>
        children({ summary, openEditor });
      render(
        <CampusShell
          LogOutAction={({ children }) =>
            children({ logOut: vi.fn(), isPending: false })
          }
          OwnProfileAction={OwnProfileAction}
          OverviewPanel={OverviewPanelStub}
          cohortId="c-1"
          viewer={VIEWER}
        >
          <p>Route content</p>
        </CampusShell>,
      );
      return { openEditor };
    }

    it("names the member, their place and their status", async () => {
      renderWithProfile();

      const account = await openAccount("Ada L.");

      expect(within(account).getByText("Backend · Cohort 2026")).toBeVisible();
      expect(within(account).getByText("ada@campus.local")).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Your account: Available" }),
      ).toBeInTheDocument();
      expect(
        within(account).getByRole("button", { name: "Available" }),
      ).toHaveAttribute("aria-pressed", "true");
    });

    it("falls back to the session's name before the profile is read", async () => {
      const OwnProfileAction: OwnProfileActionComponent = ({ children }) =>
        children({ summary: undefined, openEditor: vi.fn() });
      render(
        <CampusShell
          OwnProfileAction={OwnProfileAction}
          OverviewPanel={OverviewPanelStub}
          cohortId="c-1"
          viewer={VIEWER}
        >
          <p>Route content</p>
        </CampusShell>,
      );

      expect(await openAccount("Ada Lovelace")).toBeVisible();
    });

    it.each([
      ["Edit profile", "profile"],
      ["Change character", "character"],
    ])("opens the editor on %s and closes the menu", async (item, section) => {
      const { openEditor } = renderWithProfile();

      const account = await openAccount("Ada L.");
      fireEvent.click(within(account).getByRole("button", { name: item }));

      expect(openEditor).toHaveBeenCalledExactlyOnceWith(section);
      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "Ada L." })).toBeNull();
      });
    });

    it("offers no profile items when the route passes no profile", async () => {
      renderWithLogOut({ logOut: vi.fn(), isPending: false });

      const account = await openAccount();

      expect(
        within(account).queryByRole("button", { name: "Edit profile" }),
      ).toBeNull();
    });
  });
});
