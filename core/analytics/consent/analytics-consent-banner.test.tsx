import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  denyAnalyticsConsent: vi.fn(),
  grantAnalyticsConsent: vi.fn(),
  readAnalyticsConsent: vi.fn(),
}));

vi.mock("../client", () => client);

beforeEach(() => {
  vi.clearAllMocks();
  client.readAnalyticsConsent.mockResolvedValue("pending");
});

afterEach(() => {
  vi.resetModules();
});

describe("AnalyticsConsentBanner", () => {
  it("renders nothing before the stored choice is read", async () => {
    client.readAnalyticsConsent.mockReturnValue(new Promise(() => undefined));
    const { AnalyticsConsentBanner } = await import(".");

    const { container } = render(<AnalyticsConsentBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each(["unavailable", "granted", "denied"] as const)(
    "renders nothing once the choice is %s",
    async (consent) => {
      client.readAnalyticsConsent.mockResolvedValue(consent);
      const { AnalyticsConsentBanner } = await import(".");

      const { container } = render(<AnalyticsConsentBanner />);
      await vi.waitFor(() =>
        expect(client.readAnalyticsConsent).toHaveBeenCalled(),
      );
      await Promise.resolve();

      expect(container).toBeEmptyDOMElement();
    },
  );

  it("asks for a pending choice in a labelled region", async () => {
    const { AnalyticsConsentBanner } = await import(".");

    render(<AnalyticsConsentBanner />);

    const banner = await screen.findByRole("region", {
      name: "Analytics cookies",
    });
    expect(banner).toHaveTextContent(
      "Campus uses PostHog to learn which pages and features people use.",
    );
    expect(banner).toHaveTextContent("Never your name or email.");
    expect(screen.getByRole("button", { name: "Reject" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Accept" })).toBeVisible();
  });

  it("gives Reject and Accept equal weight, Reject first", async () => {
    const { AnalyticsConsentBanner } = await import(".");

    render(<AnalyticsConsentBanner />);

    const [reject, accept] = await screen.findAllByRole("button");
    expect(reject).toHaveAccessibleName("Reject");
    expect(accept).toHaveAccessibleName("Accept");
    expect(reject?.className).toBe(accept?.className);
  });

  it("grants consent and goes away on Accept", async () => {
    const { AnalyticsConsentBanner } = await import(".");
    render(<AnalyticsConsentBanner />);

    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));

    expect(client.grantAnalyticsConsent).toHaveBeenCalledOnce();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("denies consent and goes away on Reject", async () => {
    const { AnalyticsConsentBanner } = await import(".");
    render(<AnalyticsConsentBanner />);

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));

    expect(client.denyAnalyticsConsent).toHaveBeenCalledOnce();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("stays open and decides nothing on Escape", async () => {
    const { AnalyticsConsentBanner } = await import(".");
    render(<AnalyticsConsentBanner />);
    const banner = await screen.findByRole("region", {
      name: "Analytics cookies",
    });

    fireEvent.keyDown(screen.getByRole("button", { name: "Accept" }), {
      key: "Escape",
    });

    expect(banner).toBeInTheDocument();
    expect(client.grantAnalyticsConsent).not.toHaveBeenCalled();
    expect(client.denyAnalyticsConsent).not.toHaveBeenCalled();
  });

  it("comes back when the member reopens Privacy choices", async () => {
    client.readAnalyticsConsent.mockResolvedValue("granted");
    const { AnalyticsConsentBanner, openAnalyticsConsentChoices } =
      await import(".");
    render(<AnalyticsConsentBanner />);
    await vi.waitFor(() =>
      expect(client.readAnalyticsConsent).toHaveBeenCalled(),
    );
    await Promise.resolve();

    act(() => openAnalyticsConsentChoices());

    expect(
      screen.getByRole("region", { name: "Analytics cookies" }),
    ).toBeVisible();
  });
});
