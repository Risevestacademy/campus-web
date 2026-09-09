import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ANALYTICS_EVENTS } from "./events";

const analyticsMocks = vi.hoisted(() => {
  const browser = {
    capture: vi.fn(),
    identify: vi.fn(),
    init: vi.fn(),
    reset: vi.fn(),
  };
  const server = {
    captureImmediate: vi.fn(),
  };

  return {
    browser,
    PostHog: vi.fn(function PostHogMock() {
      return server;
    }),
    server,
  };
});

vi.mock("posthog-js", () => ({
  default: analyticsMocks.browser,
}));

vi.mock("posthog-node", () => ({
  PostHog: analyticsMocks.PostHog,
}));

vi.mock("server-only", () => ({}));

beforeEach(() => {
  vi.clearAllMocks();
  analyticsMocks.server.captureImmediate.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("browser analytics", () => {
  it("does not initialize or capture without a project token", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");

    const analytics = await import("./client");

    expect(analytics.initializeBrowserAnalytics()).toBe(false);

    analytics.captureBrowserAnalyticsEvent(
      ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED,
      {
        auth_method: "email",
        platform: "web",
      },
    );

    expect(analyticsMocks.browser.init).not.toHaveBeenCalled();
    expect(analyticsMocks.browser.capture).not.toHaveBeenCalled();
  });

  it("initializes once with the privacy-minimal configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", " phc_non_production ");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", " https://eu.i.posthog.com ");

    const analytics = await import("./client");

    expect(analytics.initializeBrowserAnalytics()).toBe(true);
    expect(analytics.initializeBrowserAnalytics()).toBe(true);
    expect(analyticsMocks.browser.init).toHaveBeenCalledTimes(1);
    expect(analyticsMocks.browser.init).toHaveBeenCalledWith(
      "phc_non_production",
      {
        api_host: "https://eu.i.posthog.com",
        autocapture: false,
        capture_pageleave: false,
        capture_pageview: "history_change",
        defaults: "2026-01-30",
        disable_session_recording: true,
        person_profiles: "identified_only",
      },
    );
  });

  it("captures typed events and manages authenticated identity", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_non_production");

    const analytics = await import("./client");
    analytics.initializeBrowserAnalytics();

    const properties = {
      auth_method: "rise_sso" as const,
      platform: "web" as const,
    };

    analytics.captureBrowserAnalyticsEvent(
      ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED,
      properties,
    );
    analytics.identifyAnalyticsUser({
      cohortId: "cohort-1",
      id: " user-1 ",
      role: "student",
      trackId: "track-1",
    });
    analytics.resetAnalyticsUser();

    expect(analyticsMocks.browser.capture).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED,
      properties,
    );
    expect(analyticsMocks.browser.identify).toHaveBeenCalledWith("user-1", {
      account_status: undefined,
      cohort_id: "cohort-1",
      role: "student",
      track_id: "track-1",
    });
    expect(analyticsMocks.browser.reset).toHaveBeenCalledOnce();
  });

  it("does not let initialization failures break hydration", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_non_production");
    analyticsMocks.browser.init.mockImplementationOnce(() => {
      throw new Error("initialization failed");
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const analytics = await import("./client");

    expect(analytics.initializeBrowserAnalytics()).toBe(false);
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it("does not let browser SDK failures break product operations", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_non_production");

    const analytics = await import("./client");
    analytics.initializeBrowserAnalytics();

    const sdkFailure = new Error("browser SDK failed");
    analyticsMocks.browser.capture.mockImplementationOnce(() => {
      throw sdkFailure;
    });
    analyticsMocks.browser.identify.mockImplementationOnce(() => {
      throw sdkFailure;
    });
    analyticsMocks.browser.reset.mockImplementationOnce(() => {
      throw sdkFailure;
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(() =>
      analytics.captureBrowserAnalyticsEvent(
        ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED,
        {
          auth_method: "email",
          platform: "web",
        },
      ),
    ).not.toThrow();
    expect(() =>
      analytics.identifyAnalyticsUser({
        id: "user-1",
        role: "student",
      }),
    ).not.toThrow();
    expect(() => analytics.resetAnalyticsUser()).not.toThrow();
    expect(consoleError).toHaveBeenCalledTimes(3);
  });

  it("is initialized by the Next.js client instrumentation entrypoint", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_non_production");

    await import("../../instrumentation-client");

    expect(analyticsMocks.browser.init).toHaveBeenCalledOnce();
  });
});

describe("server analytics", () => {
  it("does not create a server client without a project token", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");

    const { captureServerAnalyticsEvent } = await import("./server");

    await captureServerAnalyticsEvent(
      ANALYTICS_EVENTS.AUTH_LOGIN_SUCCEEDED,
      "user-1",
      {
        auth_method: "rise_sso",
        role: "student",
        user_id: "user-1",
      },
    );

    expect(analyticsMocks.PostHog).not.toHaveBeenCalled();
  });

  it("sends trusted server events immediately", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_non_production");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");

    const { captureServerAnalyticsEvent } = await import("./server");
    const properties = {
      auth_method: "rise_sso" as const,
      role: "student",
      user_id: "user-1",
    };

    await captureServerAnalyticsEvent(
      ANALYTICS_EVENTS.AUTH_LOGIN_SUCCEEDED,
      " user-1 ",
      properties,
    );

    expect(analyticsMocks.PostHog).toHaveBeenCalledWith("phc_non_production", {
      flushAt: 1,
      flushInterval: 0,
      host: "https://eu.i.posthog.com",
    });
    expect(analyticsMocks.server.captureImmediate).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: ANALYTICS_EVENTS.AUTH_LOGIN_SUCCEEDED,
      properties,
    });
  });

  it("does not let delivery failures break business operations", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_non_production");
    analyticsMocks.server.captureImmediate.mockRejectedValueOnce(
      new Error("network unavailable"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { captureServerAnalyticsEvent } = await import("./server");

    await expect(
      captureServerAnalyticsEvent(
        ANALYTICS_EVENTS.AUTH_LOGIN_FAILED,
        "anonymous-1",
        {
          auth_method: "email",
          error_code: "INVALID_CREDENTIALS",
        },
      ),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledOnce();
  });
});
