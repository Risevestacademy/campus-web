import { act, fireEvent, render, screen } from "@testing-library/react";
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
    expect(banner).toHaveTextContent("Never a name or email.");
    expect(banner).toHaveTextContent(
      "The choice applies to everyone using this browser.",
    );
    expect(screen.getByRole("button", { name: "Reject" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Accept" })).toBeVisible();
  });

  it("leaves focus where it was on a first visit", async () => {
    const { AnalyticsConsentBanner } = await import(".");

    render(<AnalyticsConsentBanner />);

    expect(
      await screen.findByRole("region", { name: "Analytics cookies" }),
    ).not.toHaveFocus();
    expect(document.body).toHaveFocus();
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

  describe("focus", () => {
    async function reviewFrom(consent: "granted" | "denied") {
      client.readAnalyticsConsent.mockResolvedValue(consent);
      const { AnalyticsConsentBanner, openAnalyticsConsentChoices } =
        await import(".");
      render(
        <>
          <button type="button" onClick={openAnalyticsConsentChoices}>
            Privacy choices
          </button>
          <AnalyticsConsentBanner />
        </>,
      );
      await vi.waitFor(() =>
        expect(client.readAnalyticsConsent).toHaveBeenCalled(),
      );
      await Promise.resolve();
      const trigger = screen.getByRole("button", { name: "Privacy choices" });
      trigger.focus();
      fireEvent.click(trigger);
      return { trigger };
    }

    it("moves to a reopened choice", async () => {
      await reviewFrom("granted");

      expect(
        screen.getByRole("region", { name: "Analytics cookies" }),
      ).toHaveFocus();
    });

    it("returns to Privacy choices once the reopened choice is made", async () => {
      const { trigger } = await reviewFrom("granted");

      fireEvent.click(screen.getByRole("button", { name: "Reject" }));

      expect(client.denyAnalyticsConsent).toHaveBeenCalledOnce();
      expect(trigger).toHaveFocus();
    });

    it("closes a reopened choice on Escape, keeping it, and returns to Privacy choices", async () => {
      const { trigger } = await reviewFrom("denied");

      fireEvent.keyDown(
        screen.getByRole("region", { name: "Analytics cookies" }),
        { key: "Escape" },
      );

      expect(screen.queryByRole("region")).not.toBeInTheDocument();
      expect(client.grantAnalyticsConsent).not.toHaveBeenCalled();
      expect(client.denyAnalyticsConsent).not.toHaveBeenCalled();
      expect(trigger).toHaveFocus();
    });

    it("returns to where it came from after a keyboard choice on a first visit", async () => {
      const { AnalyticsConsentBanner } = await import(".");
      render(
        <>
          <button type="button">Next page</button>
          <AnalyticsConsentBanner />
        </>,
      );
      const previous = screen.getByRole("button", { name: "Next page" });
      previous.focus();
      const reject = await screen.findByRole("button", { name: "Reject" });
      reject.focus();

      fireEvent.click(reject);

      expect(previous).toHaveFocus();
    });
  });
});
