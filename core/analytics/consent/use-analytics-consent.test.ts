import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  denyAnalyticsConsent: vi.fn(),
  grantAnalyticsConsent: vi.fn(),
  readAnalyticsConsent: vi.fn(() => Promise.resolve("pending")),
}));

vi.mock("../client", () => client);

afterEach(() => {
  vi.resetModules();
});

describe("useAnalyticsConsent", () => {
  it("opens once the pending choice is read and closes on Accept", async () => {
    const { useAnalyticsConsent } = await import("./use-analytics-consent");

    const { result } = renderHook(() => useAnalyticsConsent());

    expect(result.current.isOpen).toBe(false);
    await waitFor(() => expect(result.current.isOpen).toBe(true));

    act(() => result.current.accept());

    expect(result.current.isOpen).toBe(false);
    expect(client.grantAnalyticsConsent).toHaveBeenCalledOnce();
  });
});
