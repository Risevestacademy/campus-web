import { fireEvent, render, screen } from "@testing-library/react";
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

describe("CampusRail", () => {
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
