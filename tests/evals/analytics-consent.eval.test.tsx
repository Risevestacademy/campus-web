import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ANALYTICS_CONSENT_KEY as CONSENT_KEY } from "@/core/analytics/consent-key";
import {
  clearBrowserStorage,
  loadRealAnalytics,
  type PostHogRequest,
  storedKeys,
  stubPostHogEnvironment,
} from "@/tests/fixtures/real-posthog";

const TOKEN = "phc_consent_eval";

const observed = vi.hoisted(() => ({ sent: [] as string[] }));
let requests: PostHogRequest[] = [];

vi.mock("@/core/analytics/scrub", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/core/analytics/scrub")>();
  return {
    scrubAnalyticsEvent: (
      event: Parameters<typeof real.scrubAnalyticsEvent>[0],
    ) => {
      if (event) observed.sent.push(event.event);
      return real.scrubAnalyticsEvent(event);
    },
  };
});

type AnalyticsClient = typeof import("@/core/analytics/client");

function analyticsKeys(): string[] {
  return storedKeys().filter(
    (key) => key.includes("ph_") || key === CONSENT_KEY,
  );
}

// Fetches plus script loads: posthog-js fetches its remote config as a script.
function postHogRequests(): string[] {
  const scripts = [...document.scripts]
    .map((script) => script.src)
    .filter((source) => source.includes("posthog"));
  return [...requests.map(({ url }) => url), ...scripts];
}

// The flags call fired ~0.7 s after start-up; fake timers run it at once.
async function runStartupTimers(): Promise<void> {
  await vi.advanceTimersByTimeAsync(5_000);
}

// Each fresh SDK wraps pushState for history_change pageviews. Unwrapping
// keeps an earlier case's instance from capturing in a later case.
const { pushState, replaceState } = history;

beforeEach(() => {
  history.pushState = pushState;
  history.replaceState = replaceState;
  clearBrowserStorage();
  observed.sent.length = 0;
  requests = stubPostHogEnvironment(TOKEN);
});

afterEach(() => {
  vi.useRealTimers();
  document.querySelectorAll("script[src]").forEach((script) => script.remove());
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Analytics consent eval (threshold: every case holds)", () => {
  it("reloads a fresh PostHog SDK for each simulated page load", async () => {
    vi.resetModules();
    const first = (await import("posthog-js")).default;
    vi.resetModules();
    const second = (await import("posthog-js")).default;

    expect(second).not.toBe(first);
  });

  it("writes nothing and sends no request at all before a choice", async () => {
    vi.useFakeTimers();
    const analytics = await loadRealAnalytics();

    history.pushState(null, "", "/campus");
    analytics.identifyAnalyticsUser({ id: "user-1", systemRole: "user" });
    await analytics.initializeBrowserAnalytics();
    await runStartupTimers();

    expect(await analytics.readAnalyticsConsent()).toBe("pending");
    expect(observed.sent).toEqual([]);
    expect(postHogRequests()).toEqual([]);
    expect(analyticsKeys()).toEqual([]);
  });

  it("stores only the consent key on Reject, and sends no request after it", async () => {
    vi.useFakeTimers();
    const analytics = await loadRealAnalytics();

    analytics.denyAnalyticsConsent();
    await analytics.initializeBrowserAnalytics();
    history.pushState(null, "", "/campus/after-reject");

    expect(analyticsKeys()).toEqual([CONSENT_KEY]);
    expect(localStorage.getItem(CONSENT_KEY)).toBe("0");

    const reloaded = await loadRealAnalytics();
    reloaded.identifyAnalyticsUser({ id: "user-1", systemRole: "user" });
    history.pushState(null, "", "/campus/after-reload");
    await reloaded.initializeBrowserAnalytics();
    await runStartupTimers();

    expect(await reloaded.readAnalyticsConsent()).toBe("denied");
    expect(observed.sent).toEqual([]);
    expect(postHogRequests()).toEqual([]);
  });

  it("sends one $opt_in on Accept, then the page's $pageview", async () => {
    const analytics = await loadRealAnalytics();

    analytics.grantAnalyticsConsent();
    await analytics.initializeBrowserAnalytics();

    expect(localStorage.getItem(CONSENT_KEY)).toBe("1");
    expect(observed.sent).toEqual(["$opt_in", "$pageview"]);
  });

  it("captures nothing after Accept then Reject, and leaves only the consent key", async () => {
    vi.useFakeTimers();
    const analytics = await loadRealAnalytics();
    analytics.grantAnalyticsConsent();
    await analytics.initializeBrowserAnalytics();
    const capturedWhileGranted = [...observed.sent];
    requests.length = 0;
    observed.sent.length = 0;

    analytics.denyAnalyticsConsent();
    await analytics.initializeBrowserAnalytics();
    analytics.captureBrowserPageview("/campus/after-withdrawal");
    await analytics.initializeBrowserAnalytics();
    await runStartupTimers();

    expect(await analytics.readAnalyticsConsent()).toBe("denied");
    expect(analyticsKeys()).toEqual([CONSENT_KEY]);
    expect(observed.sent).toEqual([]);
    // Reject flushes what was captured while granted; nothing newer leaves.
    expect(
      postHogRequests().filter((url) => new URL(url).pathname !== "/e/"),
    ).toEqual([]);
    expect(capturedWhileGranted).toEqual(
      expect.arrayContaining(requests.flatMap(({ events }) => events)),
    );
  });

  it("identifies the member waiting here when another tab accepts, without a second $opt_in", async () => {
    const analytics = await loadRealAnalytics();
    const stop = analytics.watchAnalyticsConsent(() => undefined);
    analytics.identifyAnalyticsUser({ id: "user-1", systemRole: "user" });
    await analytics.initializeBrowserAnalytics();

    localStorage.setItem(CONSENT_KEY, "1");
    window.dispatchEvent(new StorageEvent("storage", { key: CONSENT_KEY }));
    await analytics.initializeBrowserAnalytics();
    stop();

    expect(await analytics.readAnalyticsConsent()).toBe("granted");
    expect(observed.sent).toEqual(["$identify"]);
  });

  it("keeps an accepted choice across logout without a second $opt_in", async () => {
    const analytics = await loadRealAnalytics();
    analytics.grantAnalyticsConsent();
    await analytics.initializeBrowserAnalytics();

    analytics.resetAnalyticsUser();
    await analytics.initializeBrowserAnalytics();

    expect(await analytics.readAnalyticsConsent()).toBe("granted");
    expect(observed.sent.filter((event) => event === "$opt_in")).toHaveLength(
      1,
    );
  });

  describe.each(SDK_TIMINGS)("with calls made %s", (timing) => {
    it.each(orderCases())(
      "identifies only while granted, starting %s: %s",
      async (start, order) => {
        const { posthog, identifiedWhile, analytics } =
          await loadSpiedAnalytics(start, timing);

        for (const step of order) STEP_CALLS[step](analytics);
        await analytics.initializeBrowserAnalytics();

        expect(identifiedWhile.every((status) => status === "granted")).toBe(
          true,
        );
        if (order.indexOf("logout") > order.indexOf("identify")) {
          expect(posthog.get_distinct_id()).not.toBe(MEMBER.id);
        }
      },
    );
  });

  it.each(NON_ACCEPT_ACTIONS)(
    "leaves the choice pending after %s",
    async (_, act) => {
      const { analytics, consent } = await loadBannerStack();
      const view = render(<consent.AnalyticsConsentBanner />);
      const banner = await screen.findByRole("region", {
        name: "Analytics cookies",
      });

      act({ analytics, banner, consent, view });
      await analytics.initializeBrowserAnalytics();

      expect(await analytics.readAnalyticsConsent()).toBe("pending");
      expect(localStorage.getItem(CONSENT_KEY)).toBeNull();
      expect(observed.sent).not.toContain("$opt_in");
    },
  );

  it("grants through the banner's Accept and nothing else", async () => {
    const { analytics, consent } = await loadBannerStack();
    render(<consent.AnalyticsConsentBanner />);

    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    await analytics.initializeBrowserAnalytics();

    expect(await analytics.readAnalyticsConsent()).toBe("granted");
    expect(observed.sent.filter((event) => event === "$opt_in")).toHaveLength(
      1,
    );
  });
});

const MEMBER = { id: "user-1", systemRole: "user" } as const;

const SDK_TIMINGS = ["after PostHog loads", "while PostHog loads"] as const;
type SdkTiming = (typeof SDK_TIMINGS)[number];

const STARTING_CHOICES = { pending: null, granted: "1", denied: "0" } as const;
type StartingChoice = keyof typeof STARTING_CHOICES;

const STEP_CALLS = {
  identify: (analytics: AnalyticsClient) =>
    analytics.identifyAnalyticsUser(MEMBER),
  logout: (analytics: AnalyticsClient) => analytics.resetAnalyticsUser(),
  grant: (analytics: AnalyticsClient) => analytics.grantAnalyticsConsent(),
  deny: (analytics: AnalyticsClient) => analytics.denyAnalyticsConsent(),
};
type Step = keyof typeof STEP_CALLS;

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    permutations(items.filter((_, other) => other !== index)).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

function orderCases(): [StartingChoice, Step[]][] {
  const orders = permutations(Object.keys(STEP_CALLS) as Step[]);
  return (Object.keys(STARTING_CHOICES) as StartingChoice[]).flatMap((start) =>
    orders.map((order): [StartingChoice, Step[]] => [start, order]),
  );
}

async function loadSpiedAnalytics(start: StartingChoice, timing: SdkTiming) {
  const stored = STARTING_CHOICES[start];
  if (stored) localStorage.setItem(CONSENT_KEY, stored);

  vi.resetModules();
  const { default: posthog } = await import("posthog-js");
  const identify = posthog.identify.bind(posthog);
  const identifiedWhile: string[] = [];
  vi.spyOn(posthog, "identify").mockImplementation((...arguments_) => {
    identifiedWhile.push(posthog.get_explicit_consent_status());
    identify(...arguments_);
  });

  const analytics = await import("@/core/analytics/client");
  const loading = analytics.initializeBrowserAnalytics();
  if (timing === "after PostHog loads") await loading;

  return { analytics, identifiedWhile, posthog };
}

type ConsentModule = typeof import("@/core/analytics/consent");

async function loadBannerStack() {
  const analytics = await loadRealAnalytics();
  const consent: ConsentModule = await import("@/core/analytics/consent");
  return { analytics, consent };
}

type BannerAction = (stack: {
  analytics: AnalyticsClient;
  banner: HTMLElement;
  consent: ConsentModule;
  view: ReturnType<typeof render>;
}) => void;

const NON_ACCEPT_ACTIONS: [string, BannerAction][] = [
  ["Escape", ({ banner }) => fireEvent.keyDown(banner, { key: "Escape" })],
  [
    "a click outside the banner",
    () => {
      fireEvent.pointerDown(document.body);
      fireEvent.click(document.body);
    },
  ],
  [
    "a remount",
    ({ consent, view }) => {
      view.unmount();
      render(<consent.AnalyticsConsentBanner />);
    },
  ],
  [
    "a cohort switch",
    ({ analytics }) => {
      analytics.identifyAnalyticsUser(MEMBER);
      analytics.enterAnalyticsCohort({ cohortId: "cohort-1" })();
      analytics.enterAnalyticsCohort({ cohortId: "cohort-2" });
    },
  ],
  [
    "reopening Privacy choices, then Escape",
    ({ banner, consent }) => {
      consent.openAnalyticsConsentChoices();
      fireEvent.keyDown(banner, { key: "Escape" });
    },
  ],
  ["a logout", ({ analytics }) => analytics.resetAnalyticsUser()],
];
