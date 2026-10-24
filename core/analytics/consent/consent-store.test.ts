import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  denyAnalyticsConsent: vi.fn(),
  grantAnalyticsConsent: vi.fn(),
  readAnalyticsConsent: vi.fn(),
  watchAnalyticsConsent: vi.fn(),
}));

vi.mock("../client", () => client);

beforeEach(() => {
  vi.clearAllMocks();
  client.readAnalyticsConsent.mockResolvedValue("pending");
  client.watchAnalyticsConsent.mockReturnValue(() => undefined);
});

afterEach(() => {
  vi.resetModules();
});

describe("analytics consent store", () => {
  it("renders the server snapshot as unknown and closed", async () => {
    const store = await import("./consent-store");

    const snapshot = store.getServerAnalyticsConsentSnapshot();

    expect(snapshot).toEqual({ consent: "unknown", reviewing: false });
    expect(store.isConsentChoiceOpen(snapshot)).toBe(false);
  });

  it("reads the stored choice once, on the first subscriber", async () => {
    const store = await import("./consent-store");
    const listener = vi.fn();

    store.subscribeToAnalyticsConsent(listener);
    store.subscribeToAnalyticsConsent(vi.fn());
    await consentRead(store);

    expect(client.readAnalyticsConsent).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledOnce();
    expect(store.getAnalyticsConsentSnapshot()).toEqual({
      consent: "pending",
      reviewing: false,
    });
  });

  it("opens for a pending choice", async () => {
    const store = await subscribedStore();

    expect(isOpen(store)).toBe(true);
  });

  it("stays closed when analytics is unavailable", async () => {
    client.readAnalyticsConsent.mockResolvedValue("unavailable");
    const store = await subscribedStore();

    expect(isOpen(store)).toBe(false);
  });

  it("grants consent and closes on Accept", async () => {
    const store = await subscribedStore();
    const listener = vi.fn();
    store.subscribeToAnalyticsConsent(listener);

    store.acceptAnalyticsConsent();

    expect(client.grantAnalyticsConsent).toHaveBeenCalledOnce();
    expect(client.denyAnalyticsConsent).not.toHaveBeenCalled();
    expect(store.getAnalyticsConsentSnapshot().consent).toBe("granted");
    expect(isOpen(store)).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("denies consent and closes on Reject", async () => {
    const store = await subscribedStore();

    store.rejectAnalyticsConsent();

    expect(client.denyAnalyticsConsent).toHaveBeenCalledOnce();
    expect(client.grantAnalyticsConsent).not.toHaveBeenCalled();
    expect(store.getAnalyticsConsentSnapshot().consent).toBe("denied");
    expect(isOpen(store)).toBe(false);
  });

  it("reopens a made choice so it can be changed", async () => {
    client.readAnalyticsConsent.mockResolvedValue("granted");
    const store = await subscribedStore();

    store.openAnalyticsConsentChoices();
    expect(isOpen(store)).toBe(true);

    store.rejectAnalyticsConsent();

    expect(client.denyAnalyticsConsent).toHaveBeenCalledOnce();
    expect(isOpen(store)).toBe(false);
  });

  it("closes without telling PostHog again when the same choice is repeated", async () => {
    client.readAnalyticsConsent.mockResolvedValue("granted");
    const store = await subscribedStore();

    store.openAnalyticsConsentChoices();
    store.acceptAnalyticsConsent();

    expect(client.grantAnalyticsConsent).not.toHaveBeenCalled();
    expect(isOpen(store)).toBe(false);
  });

  it("does not reopen before the stored choice is known", async () => {
    const store = await import("./consent-store");

    store.openAnalyticsConsentChoices();

    expect(isOpen(store)).toBe(false);
  });

  it("does not reopen when analytics is unavailable", async () => {
    client.readAnalyticsConsent.mockResolvedValue("unavailable");
    const store = await subscribedStore();

    store.openAnalyticsConsentChoices();

    expect(isOpen(store)).toBe(false);
  });

  it("keeps a choice made before the stored one was read", async () => {
    const read = Promise.withResolvers<"pending">();
    client.readAnalyticsConsent.mockReturnValue(read.promise);
    const store = await import("./consent-store");
    store.subscribeToAnalyticsConsent(vi.fn());

    store.acceptAnalyticsConsent();
    read.resolve("pending");
    await read.promise;
    await Promise.resolve();

    expect(store.getAnalyticsConsentSnapshot().consent).toBe("granted");
  });

  it("ignores a reopen made before the stored choice was read", async () => {
    const read = Promise.withResolvers<"granted">();
    client.readAnalyticsConsent.mockReturnValue(read.promise);
    const store = await import("./consent-store");
    store.subscribeToAnalyticsConsent(vi.fn());

    store.openAnalyticsConsentChoices();
    read.resolve("granted");
    await consentRead(store);

    expect(isOpen(store)).toBe(false);
  });

  it("closes a reopened choice without changing it", async () => {
    client.readAnalyticsConsent.mockResolvedValue("granted");
    const store = await subscribedStore();

    store.openAnalyticsConsentChoices();
    store.closeAnalyticsConsentChoices();

    expect(store.getAnalyticsConsentSnapshot()).toEqual({
      consent: "granted",
      reviewing: false,
    });
    expect(client.grantAnalyticsConsent).not.toHaveBeenCalled();
    expect(client.denyAnalyticsConsent).not.toHaveBeenCalled();
  });

  it("watches other tabs once, however many subscribe", async () => {
    const store = await import("./consent-store");

    store.subscribeToAnalyticsConsent(vi.fn());
    store.subscribeToAnalyticsConsent(vi.fn());

    expect(client.watchAnalyticsConsent).toHaveBeenCalledOnce();
  });

  it("takes a choice made in another tab and closes a review here", async () => {
    const store = await subscribedStore();
    const [[chosenElsewhere]] = client.watchAnalyticsConsent.mock.calls as [
      [(consent: "granted" | "denied") => void],
    ];
    store.openAnalyticsConsentChoices();

    chosenElsewhere("denied");

    expect(store.getAnalyticsConsentSnapshot()).toEqual({
      consent: "denied",
      reviewing: false,
    });
    expect(client.denyAnalyticsConsent).not.toHaveBeenCalled();
  });

  it("returns the same snapshot until it changes", async () => {
    const store = await subscribedStore();
    const pending = store.getAnalyticsConsentSnapshot();

    expect(store.getAnalyticsConsentSnapshot()).toBe(pending);

    store.openAnalyticsConsentChoices();

    expect(store.getAnalyticsConsentSnapshot()).not.toBe(pending);
  });
});

type ConsentStore = typeof import("./consent-store");

async function subscribedStore(): Promise<ConsentStore> {
  const store = await import("./consent-store");
  store.subscribeToAnalyticsConsent(vi.fn());
  await consentRead(store);
  return store;
}

async function consentRead(store: ConsentStore): Promise<void> {
  await vi.waitFor(() =>
    expect(store.getAnalyticsConsentSnapshot().consent).not.toBe("unknown"),
  );
}

function isOpen(store: ConsentStore): boolean {
  return store.isConsentChoiceOpen(store.getAnalyticsConsentSnapshot());
}
