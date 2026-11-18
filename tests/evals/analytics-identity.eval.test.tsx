import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, render } from "@testing-library/react";
import type { CaptureResult, Properties } from "posthog-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ANALYTICS_EVENTS } from "@/core/analytics";
import {
  allowAnalyticsCohort,
  allowAnalyticsIdentity,
} from "@/core/analytics/events";
import { parseSessionBody } from "@/features/auth/schemas/session.schema";
import { memberAnalyticsFor } from "@/features/auth/services/member-analytics";
import type { Session } from "@/features/auth/types/auth.types";
import {
  clearBrowserStorage,
  grantStoredConsent,
  loadRealAnalytics,
  stubPostHogEnvironment,
} from "@/tests/fixtures/real-posthog";

const sent = vi.hoisted(() => [] as CaptureResult[]);

// Records what leaves the browser: the scrubbed event PostHog would send.
vi.mock("@/core/analytics/scrub", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/core/analytics/scrub")>();
  return {
    scrubAnalyticsEvent: (event: CaptureResult | null) => {
      const scrubbed = real.scrubAnalyticsEvent(event);
      if (scrubbed) sent.push(scrubbed);
      return scrubbed;
    },
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
}));

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const ROOT_LAYOUT = path.join(PROJECT_ROOT, "app/layout.tsx");
const COHORT_LAYOUT = path.join(PROJECT_ROOT, "app/campus/[id]/layout.tsx");
const SIGN_IN_PAGE = path.join(
  PROJECT_ROOT,
  "app/(auth)/(side)/sign-in/page.tsx",
);
const INVITATION_PAGE = path.join(
  PROJECT_ROOT,
  "app/(auth)/(side)/invitation/page.tsx",
);
const POSTHOG_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const TOKEN = "phc_identity_eval";
const MEMBER_A = "55555555-5555-4555-8555-555555555555";
const MEMBER_B = "66666666-6666-4666-8666-666666666666";
const COHORT_3 = "11111111-1111-4111-8111-111111111111";
const COHORT_4 = "22222222-2222-4222-8222-222222222222";
const INVITE_TOKEN = "secret-invite-token";

type Membership = Session["memberships"][number];
type Analytics = Awaited<ReturnType<typeof loadRealAnalytics>>;

const place = (cohortId: string, role?: Membership["role"]): Membership => ({
  cohortId,
  role,
  cohort: { name: "Cohort 3", code: "C3" },
});

function session(
  systemRole: Session["user"]["systemRole"],
  memberships: Session["memberships"],
): Session {
  return {
    scope: "full_access",
    expiresAt: "2099-01-01T00:15:00.000Z",
    inviteId: null,
    user: {
      id: MEMBER_A,
      email: "ada@campus.local",
      displayName: "Ada Lovelace",
      systemRole,
    },
    memberships,
  };
}

function withUnknownRole(): Session {
  const parsed = parseSessionBody(
    JSON.stringify({
      ...session("user", []),
      memberships: [{ ...place(COHORT_3), role: "owner" }],
    }),
  );
  if (!parsed) throw new Error("An unknown cohort role must keep the session.");
  return parsed;
}

const cases: [
  string,
  Session,
  string,
  Session["user"]["systemRole"],
  Membership["role"],
][] = [
  [
    "a student",
    session("user", [place(COHORT_3, "student")]),
    COHORT_3,
    "user",
    "student",
  ],
  [
    "a mentor",
    session("user", [place(COHORT_3, "mentor")]),
    COHORT_3,
    "user",
    "mentor",
  ],
  [
    "a guest",
    session("user", [place(COHORT_3, "guest")]),
    COHORT_3,
    "user",
    "guest",
  ],
  [
    "a member of several cohorts, in the visited one",
    session("user", [place(COHORT_3, "student"), place(COHORT_4, "professor")]),
    COHORT_4,
    "user",
    "professor",
  ],
  [
    "an admin without a place",
    session("admin", []),
    COHORT_3,
    "admin",
    undefined,
  ],
  [
    "an admin with a student place",
    session("admin", [place(COHORT_3, "student")]),
    COHORT_3,
    "admin",
    "student",
  ],
  [
    "a super admin without a place",
    session("super_admin", []),
    COHORT_3,
    "super_admin",
    undefined,
  ],
  [
    "a member whose role this build does not know",
    withUnknownRole(),
    COHORT_3,
    "user",
    undefined,
  ],
];

function ownKeys(properties: Properties | undefined): string[] {
  return Object.keys(properties ?? {}).filter((key) => !key.startsWith("$"));
}

// PostHog fills $set_once with campaign keys (utm_source, gclid, …) itself,
// null when the landing URL carries none.
function ownFilledKeys(properties: Properties | undefined): string[] {
  return ownKeys(properties).filter(
    (key) => properties?.[key] !== null && properties?.[key] !== undefined,
  );
}

function lastSent(eventName: string): CaptureResult | undefined {
  return sent.filter(({ event }) => event === eventName).at(-1);
}

function captureLogin(analytics: Analytics): void {
  analytics.captureBrowserAnalyticsEvent(
    ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED,
    {
      auth_method: "email",
      platform: "web",
    },
  );
}

async function lastLogin(analytics: Analytics): Promise<Properties> {
  captureLogin(analytics);
  await analytics.initializeBrowserAnalytics();
  return lastSent(ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED)?.properties ?? {};
}

// A full page load: a fresh SDK and fresh components over the same storage.
// The components load after the SDK so they share its module instance.
async function loadPage() {
  const analytics = await loadRealAnalytics();
  const [{ BrowserPageview }, { ForgetPreviousMember }, { CohortAnalytics }] =
    await Promise.all([
      import("@/core/analytics/browser-pageview"),
      import("@/features/auth/components/forget-previous-member"),
      import("@/features/auth/components/cohort-analytics"),
    ]);
  return { analytics, BrowserPageview, ForgetPreviousMember, CohortAnalytics };
}

async function lastPageview(analytics: Analytics): Promise<Properties> {
  await analytics.initializeBrowserAnalytics();
  return lastSent("$pageview")?.properties ?? {};
}

describe("Analytics identity eval (threshold: every case holds)", () => {
  describe("placement", () => {
    it("identifies members inside the Cohort Gate, outside the keyed Presence Session", () => {
      const layout = readFileSync(COHORT_LAYOUT, "utf8");
      const gate = layout.indexOf("<CohortGate");
      const cohortSession = layout.indexOf("<CohortSession");
      const presenceOpen = layout.indexOf("<PresenceSession");
      const presenceClose = layout.indexOf("</PresenceSession>");

      expect(gate).toBeGreaterThanOrEqual(0);
      expect(cohortSession).toBeGreaterThan(gate);
      expect(
        cohortSession < presenceOpen || cohortSession > presenceClose,
      ).toBe(true);
      expect(cohortSession).toBeLessThan(layout.indexOf("</CohortGate>"));
    });

    it("forgets the previous member on the sign-in page", () => {
      expect(readFileSync(SIGN_IN_PAGE, "utf8")).toContain(
        "<ForgetPreviousMember />",
      );
    });

    it("forgets the previous member on the invitation page, whose Google button skips sign-in", () => {
      expect(readFileSync(INVITATION_PAGE, "utf8")).toContain(
        "signedOut && <ForgetPreviousMember />",
      );
    });

    it("captures pageviews after every page's effects, from the end of the root layout", () => {
      const layout = readFileSync(ROOT_LAYOUT, "utf8");
      const pageview = layout.indexOf("<BrowserPageview />");

      expect(pageview).toBeGreaterThan(layout.indexOf("{children}"));
      expect(pageview).toBeLessThan(layout.indexOf("</body>"));
    });
  });

  describe("allow-list", () => {
    it.each(cases)(
      "sends PostHog only the ID, system role, cohort and cohort role of %s",
      (_, viewer, cohortId, systemRole, cohortRole) => {
        const { identity, cohort } = memberAnalyticsFor(viewer, cohortId);
        const sentIdentity = allowAnalyticsIdentity(identity);
        const sentCohort = allowAnalyticsCohort(cohort);

        expect(sentIdentity).toStrictEqual({ id: MEMBER_A, systemRole });
        expect(sentCohort).toEqual({ cohortId, cohortRole });
        expect(JSON.stringify([sentIdentity, sentCohort])).not.toMatch(/@|Ada/);
      },
    );
  });

  describe("real PostHog SDK", () => {
    beforeEach(() => {
      clearBrowserStorage();
      grantStoredConsent();
      sent.length = 0;
      stubPostHogEnvironment(TOKEN);
    });

    afterEach(() => {
      cleanup();
      vi.useRealTimers();
      window.history.replaceState(null, "", "/");
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it("identifies with system_role alone on the person, and no invitation token", async () => {
      window.history.replaceState(
        null,
        "",
        `/invitation?token=${INVITE_TOKEN}`,
      );
      const analytics = await loadRealAnalytics();

      analytics.identifyAnalyticsUser({ id: MEMBER_A, systemRole: "user" });
      await analytics.initializeBrowserAnalytics();

      const identify = lastSent("$identify");
      expect(identify?.properties.distinct_id).toBe(MEMBER_A);
      expect(identify?.$set).toMatchObject({ system_role: "user" });
      expect(ownKeys(identify?.$set)).toEqual(["system_role"]);
      expect(ownFilledKeys(identify?.$set_once)).toEqual([]);
      expect(JSON.stringify(sent)).not.toContain(INVITE_TOKEN);
      expect(JSON.stringify(sent)).not.toContain("@campus");
    });

    it("carries the cohort, its group and cohort role on the tab's events, never on the person", async () => {
      const analytics = await loadRealAnalytics();

      analytics.identifyAnalyticsUser({ id: MEMBER_A, systemRole: "admin" });
      const leave = analytics.enterAnalyticsCohort({
        cohortId: COHORT_3,
        cohortRole: "mentor",
      });
      const inCohort = await lastLogin(analytics);

      expect(inCohort).toMatchObject({
        cohort_id: COHORT_3,
        cohort_role: "mentor",
        $groups: { cohort: COHORT_3 },
      });
      expect(lastSent("$identify")?.$set).not.toHaveProperty("cohort_id");
      expect(lastSent("$identify")?.$set).not.toHaveProperty("cohort_role");

      leave();
      const afterLeaving = await lastLogin(analytics);

      expect(afterLeaving).not.toHaveProperty("cohort_id");
      expect(afterLeaving).not.toHaveProperty("cohort_role");
      expect(afterLeaving).not.toHaveProperty(["$groups", "cohort"]);
    });

    it("gives the next person on the device a new distinct ID and device ID at sign-in", async () => {
      const analytics = await loadRealAnalytics();
      analytics.identifyAnalyticsUser({ id: MEMBER_A, systemRole: "user" });
      const asMemberA = await lastLogin(analytics);

      analytics.resetIdentifiedAnalyticsUser();
      const afterSignIn = await lastLogin(analytics);

      expect(asMemberA.distinct_id).toBe(MEMBER_A);
      expect(afterSignIn.distinct_id).not.toBe(MEMBER_A);
      expect(afterSignIn.$device_id).toBeTruthy();
      expect(afterSignIn.$device_id).not.toBe(asMemberA.$device_id);
    });

    it("joins an invitee's anonymous visit to the login that follows it", async () => {
      const analytics = await loadRealAnalytics();
      const visit = await lastLogin(analytics);

      analytics.resetIdentifiedAnalyticsUser();
      analytics.identifyAnalyticsUser({ id: MEMBER_B, systemRole: "user" });
      await analytics.initializeBrowserAnalytics();

      const identify = lastSent("$identify");
      expect(identify?.properties.distinct_id).toBe(MEMBER_B);
      expect(identify?.properties.$anon_distinct_id).toBe(visit.distinct_id);
    });

    it("never merges a member into the one identified before them", async () => {
      const analytics = await loadRealAnalytics();
      analytics.identifyAnalyticsUser({ id: MEMBER_A, systemRole: "user" });
      const asMemberA = await lastLogin(analytics);

      analytics.identifyAnalyticsUser({ id: MEMBER_B, systemRole: "user" });
      const asMemberB = await lastLogin(analytics);

      const identify = lastSent("$identify");
      expect(identify?.properties.distinct_id).toBe(MEMBER_B);
      expect(identify?.properties.$anon_distinct_id).not.toBe(MEMBER_A);
      expect(asMemberB.distinct_id).toBe(MEMBER_B);
      expect(asMemberB.$device_id).not.toBe(asMemberA.$device_id);
    });

    it("sends no pageview by itself, so the page's effects always go first", async () => {
      const analytics = await loadRealAnalytics();

      await new Promise((resolve) => setTimeout(resolve, 20));
      await analytics.initializeBrowserAnalytics();

      expect(lastSent("$pageview")).toBeUndefined();
    });

    it("sends the sign-in pageview as the next person, even when the SDK loaded first", async () => {
      const previous = await loadRealAnalytics();
      previous.identifyAnalyticsUser({ id: MEMBER_A, systemRole: "user" });
      const asMemberA = await lastLogin(previous);

      window.history.replaceState(null, "", "/sign-in");
      const { analytics, BrowserPageview, ForgetPreviousMember } =
        await loadPage();
      render(
        <>
          <ForgetPreviousMember />
          <BrowserPageview />
        </>,
      );
      const signIn = await lastPageview(analytics);

      expect(signIn.$pathname).toBe("/sign-in");
      expect(signIn.distinct_id).not.toBe(MEMBER_A);
      expect(signIn.$device_id).not.toBe(asMemberA.$device_id);
    });

    it("tags a cohort's landing pageview with that cohort and the member", async () => {
      window.history.replaceState(null, "", `/campus/${COHORT_4}`);
      const { analytics, BrowserPageview, CohortAnalytics } = await loadPage();
      render(
        <>
          <CohortAnalytics
            identity={{ id: MEMBER_A, systemRole: "user" }}
            cohort={{ cohortId: COHORT_4, cohortRole: "professor" }}
          />
          <BrowserPageview />
        </>,
      );

      expect(await lastPageview(analytics)).toMatchObject({
        distinct_id: MEMBER_A,
        cohort_id: COHORT_4,
        cohort_role: "professor",
        $groups: { cohort: COHORT_4 },
      });
    });

    it("never carries a cohort into the next full page load", async () => {
      const previous = await loadRealAnalytics();
      previous.enterAnalyticsCohort({
        cohortId: COHORT_3,
        cohortRole: "student",
      });
      expect(await lastLogin(previous)).toMatchObject({ cohort_id: COHORT_3 });

      const { analytics } = await loadPage();
      const nextPage = await lastLogin(analytics);

      expect(nextPage).not.toHaveProperty("cohort_id");
      expect(nextPage).not.toHaveProperty("cohort_role");
      expect(nextPage).not.toHaveProperty(["$groups", "cohort"]);
    });

    it("keeps the cohort on a tab's events after PostHog starts a new session", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const analytics = await loadRealAnalytics();
      analytics.enterAnalyticsCohort({
        cohortId: COHORT_3,
        cohortRole: "mentor",
      });
      const beforeIdle = await lastLogin(analytics);

      vi.setSystemTime(Date.now() + POSTHOG_IDLE_TIMEOUT_MS + 60_000);
      const afterIdle = await lastLogin(analytics);

      expect(afterIdle.$session_id).not.toBe(beforeIdle.$session_id);
      expect(afterIdle).toMatchObject({
        cohort_id: COHORT_3,
        cohort_role: "mentor",
        $groups: { cohort: COHORT_3 },
      });
    });
  });
});
