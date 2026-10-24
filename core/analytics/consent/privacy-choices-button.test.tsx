import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  denyAnalyticsConsent: vi.fn(),
  grantAnalyticsConsent: vi.fn(),
  readAnalyticsConsent: vi.fn(),
  watchAnalyticsConsent: vi.fn(() => () => undefined),
}));

vi.mock("../client", () => client);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetModules();
});

describe("PrivacyChoicesButton", () => {
  it.each([
    ["before the stored choice is read", new Promise(() => undefined)],
    ["when analytics is unavailable", Promise.resolve("unavailable")],
  ])("renders nothing %s", async (_, read) => {
    client.readAnalyticsConsent.mockReturnValue(read);
    const { PrivacyChoicesButton } = await import(".");

    const { container } = render(<PrivacyChoicesButton />);
    await vi.waitFor(() =>
      expect(client.readAnalyticsConsent).toHaveBeenCalled(),
    );
    await Promise.resolve();

    expect(container).toBeEmptyDOMElement();
  });

  it("reopens the analytics choice and moves focus to it", async () => {
    client.readAnalyticsConsent.mockResolvedValue("granted");
    const { AnalyticsConsentBanner, PrivacyChoicesButton } = await import(".");
    render(
      <>
        <PrivacyChoicesButton />
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
