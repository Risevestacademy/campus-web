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

    expect(await analytics.initializeBrowserAnalytics()).toBe(false);

    analytics.captureBrowserAnalyticsEvent(
      ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED,
      {
        auth_method: "email",
        platform: "web",
      },
    );
    await analytics.initializeBrowserAnalytics();

    expect(analyticsMocks.browser.init).not.toHaveBeenCalled();
    expect(analyticsMocks.browser.capture).not.toHaveBeenCalled();
  });

  it("starts PostHog off the startup path and delivers events captured while it loads", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_non_production");
    const analytics = await import("./client");
    const properties = {
      auth_method: "email" as const,
      platform: "web" as const,
    };

    const loading = analytics.initializeBrowserAnalytics();
    analytics.captureBrowserAnalyticsEvent(
      ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED,
      properties,
    );

    expect(analyticsMocks.browser.init).not.toHaveBeenCalled();
    expect(analyticsMocks.browser.capture).not.toHaveBeenCalled();

    await expect(loading).resolves.toBe(true);
    expect(analyticsMocks.browser.capture).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED,
      properties,
    );
  });

  it("initializes once with the privacy-minimal configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", " phc_non_production ");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", " https://eu.i.posthog.com ");

    const analytics = await import("./client");

    expect(await analytics.initializeBrowserAnalytics()).toBe(true);
    expect(await analytics.initializeBrowserAnalytics()).toBe(true);
    expect(analyticsMocks.browser.init).toHaveBeenCalledTimes(1);
    expect(analyticsMocks.browser.init).toHaveBeenCalledWith(
      "phc_non_production",
      {
        api_host: "https://eu.i.posthog.com",
        autocapture: false,
        before_send: expect.any(Function),
        capture_dead_clicks: false,
        capture_exceptions: false,
        capture_heatmaps: false,
        capture_pageleave: false,
        capture_pageview: "history_change",
        custom_personal_data_properties: ["token", "returnTo", "code", "state"],
        defaults: "2026-01-30",
        disable_session_recording: true,
        mask_personal_data_properties: true,
        person_profiles: "identified_only",
      },
    );
  });

  it("scrubs URL query strings from every event before it leaves the browser", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_non_production");
    const analytics = await import("./client");
    await analytics.initializeBrowserAnalytics();

    const [, config] = analyticsMocks.browser.init.mock.calls[0] as [
      string,
      { before_send: (event: unknown) => unknown },
    ];

    expect(
      config.before_send({
        uuid: "event-1",
        event: "$pageview",
        properties: {
          $current_url: "https://campus.example/invitation?token=secret",
        },
      }),
    ).toEqual({
      uuid: "event-1",
      event: "$pageview",
      properties: { $current_url: "https://campus.example/invitation" },
    });
  });

  it("strips properties outside an event's contract before capture", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_non_production");
    const analytics = await import("./client");
    await analytics.initializeBrowserAnalytics();

    analytics.captureBrowserAnalyticsEvent(
      ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED,
      {
        auth_method: "email",
        platform: "web",
        password: "must-not-be-captured",
      } as never,
    );
    await analytics.initializeBrowserAnalytics();

    expect(analyticsMocks.browser.capture).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED,
      { auth_method: "email", platform: "web" },
    );
  });

  it("drops an event carrying an email, logging the issue but never the value", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_non_production");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const analytics = await import("./client");
    await analytics.initializeBrowserAnalytics();

    analytics.captureBrowserAnalyticsEvent(
      ANALYTICS_EVENTS.AUTH_SIGNUP_SUCCEEDED,
      { auth_method: "google", role: "student", user_id: "ada@campus.local" },
    );
    analytics.identifyAnalyticsUser({
      id: "ada@campus.local",
      role: "student",
    });
    await analytics.initializeBrowserAnalytics();

    expect(analyticsMocks.browser.capture).not.toHaveBeenCalled();
    expect(analyticsMocks.browser.identify).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "ada@campus.local",
    );
  });

  it("captures typed events and manages authenticated identity", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_non_production");

    const analytics = await import("./client");
    await analytics.initializeBrowserAnalytics();

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
    await analytics.initializeBrowserAnalytics();

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

    expect(await analytics.initializeBrowserAnalytics()).toBe(false);
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it("does not let browser SDK failures break product operations", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_non_production");

    const analytics = await import("./client");
    await analytics.initializeBrowserAnalytics();

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
    await analytics.initializeBrowserAnalytics();
    expect(consoleError).toHaveBeenCalledTimes(3);
  });

  it("is initialized by the Next.js client instrumentation entrypoint", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_non_production");

    await import("../../instrumentation-client");

    await vi.waitFor(() => {
      expect(analyticsMocks.browser.init).toHaveBeenCalledOnce();
    });
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
      role: "student" as const,
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

  it("drops a server event whose distinct ID is not an opaque ID", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_non_production");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { captureServerAnalyticsEvent } = await import("./server");

    await captureServerAnalyticsEvent(
      ANALYTICS_EVENTS.AUTH_LOGIN_FAILED,
      "ada@campus.local",
      { auth_method: "email", error_code: "INVALID_CREDENTIALS" },
    );

    expect(analyticsMocks.server.captureImmediate).not.toHaveBeenCalled();
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
