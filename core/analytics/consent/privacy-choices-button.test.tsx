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

  it("is a switch: one press shows the choice, the next hides it", async () => {
    client.readAnalyticsConsent.mockResolvedValue("granted");
    const { AnalyticsConsentBanner, PrivacyChoicesButton } = await import(".");
    render(
      <>
        <PrivacyChoicesButton />
        <AnalyticsConsentBanner />
      </>,
    );
    const button = await screen.findByRole("button", {
      name: "Privacy choices",
    });
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(
      screen.getByRole("region", { name: "Analytics cookies" }),
    ).toBeVisible();
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(button);
    expect(
      screen.queryByRole("region", { name: "Analytics cookies" }),
    ).not.toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("hides a first-visit choice without answering it, and shows it again", async () => {
    client.readAnalyticsConsent.mockResolvedValue("pending");
    const { AnalyticsConsentBanner, PrivacyChoicesButton } = await import(".");
    render(
      <>
        <PrivacyChoicesButton />
        <AnalyticsConsentBanner />
      </>,
    );
    const button = await screen.findByRole("button", {
      name: "Privacy choices",
    });
    expect(
      screen.getByRole("region", { name: "Analytics cookies" }),
    ).toBeVisible();

    fireEvent.click(button);
    expect(
      screen.queryByRole("region", { name: "Analytics cookies" }),
    ).not.toBeInTheDocument();
    expect(client.grantAnalyticsConsent).not.toHaveBeenCalled();
    expect(client.denyAnalyticsConsent).not.toHaveBeenCalled();

    fireEvent.click(button);
    expect(
      screen.getByRole("region", { name: "Analytics cookies" }),
    ).toBeVisible();
  });

  it("stays after a choice is made, so it can still be changed", async () => {
    client.readAnalyticsConsent.mockResolvedValue("pending");
    const { AnalyticsConsentBanner, PrivacyChoicesButton } = await import(".");
    render(
      <>
        <PrivacyChoicesButton />
        <AnalyticsConsentBanner />
      </>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));

    expect(
      screen.queryByRole("region", { name: "Analytics cookies" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Privacy choices" }),
    ).toBeVisible();
  });
});
