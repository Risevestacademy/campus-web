import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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
