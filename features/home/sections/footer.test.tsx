import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AnalyticsConsentBanner } from "@/core/analytics/consent";

import { FooterSection } from "./footer";

vi.mock("@/core/analytics/client", () => ({
  denyAnalyticsConsent: () => undefined,
  grantAnalyticsConsent: () => undefined,
  readAnalyticsConsent: () => Promise.resolve("denied"),
}));

describe("FooterSection", () => {
  it("reopens the analytics choice from Privacy choices and moves focus to it", async () => {
    render(
      <>
        <FooterSection />
        <AnalyticsConsentBanner />
      </>,
    );
    const footer = screen.getByRole("navigation", { name: "Footer" });
    await act(() => Promise.resolve());

    fireEvent.click(
      within(footer).getByRole("button", { name: "Privacy choices" }),
    );

    const banner = await screen.findByRole("region", {
      name: "Analytics cookies",
    });
    await waitFor(() => expect(banner).toHaveFocus());
  });
});
