import type { CaptureResult, PostHog } from "posthog-js";

import { readAnalyticsConfiguration } from "./configuration";
import { ANALYTICS_CONSENT_KEY } from "./consent-key";
import { errorName } from "./error-name";
import {
  allowAnalyticsCohort,
  allowAnalyticsIdentity,
  allowAnalyticsProperties,
  type AllowedAnalyticsIdentity,
  type AnalyticsCohort,
  type AnalyticsEventMap,
  type AnalyticsEventName,
  type AnalyticsIdentity,
} from "./events";

// Invite links and returnTo values carry tokens and paths. Masking covers the
// first URL PostHog persists at init, which runs before before_send.
const PERSONAL_DATA_URL_PARAMS = ["token", "returnTo", "code", "state"];

// The group type campus-api and world use, so one breakdown joins all three.
const COHORT_GROUP_TYPE = "cohort";

interface CohortProperties {
  cohort_id: string;
  cohort_role: NonNullable<AnalyticsCohort["cohortRole"]> | null;
}

// Memory, not PostHog's session storage: it ends with the page, so a full load
// never inherits a cohort and a PostHog session rotation never drops one.
let activeCohort: CohortProperties | null = null;
let lastPageviewPath: string | null = null;

export type AnalyticsConsent = "granted" | "denied" | "pending";

let browserAnalytics: Promise<PostHog | null> | null = null;
let latestIdentity: AllowedAnalyticsIdentity | null = null;

async function loadBrowserAnalytics(): Promise<PostHog | null> {
  const configuration = readAnalyticsConfiguration();

  if (!configuration) {
    return null;
  }

  try {
    const [{ default: posthog }, { scrubAnalyticsEvent }] = await Promise.all([
      import("posthog-js"),
      import("./scrub"),
    ]);
    posthog.init(configuration.projectToken, {
      // Flags are unused; left on, they call PostHog before any choice.
      advanced_disable_flags: true,
      api_host: configuration.host,
      autocapture: false,
      before_send: [attachActiveCohort, scrubAnalyticsEvent],
      capture_dead_clicks: false,
      capture_exceptions: false,
      capture_heatmaps: false,
      capture_pageleave: false,
      capture_pageview: false,
      consent_persistence_name: ANALYTICS_CONSENT_KEY,
      custom_personal_data_properties: PERSONAL_DATA_URL_PARAMS,
      defaults: "2026-01-30",
      disable_session_recording: true,
      mask_personal_data_properties: true,
      opt_out_capturing_by_default: true,
      opt_out_persistence_by_default: true,
      person_profiles: "identified_only",
    });
    return posthog;
  } catch (error) {
    console.error("PostHog browser initialization failed.", errorName(error));
    return null;
  }
}

// The SDK loads as its own chunk, off the hydration path. Calls made while it
// loads chain onto the same promise, so they run afterwards in call order.
export function initializeBrowserAnalytics(): Promise<boolean> {
  browserAnalytics ??= loadBrowserAnalytics();
  return browserAnalytics.then((posthog) => posthog !== null);
}

export async function readAnalyticsConsent(): Promise<
  AnalyticsConsent | "unavailable"
> {
  const posthog = await browserAnalytics;
  return posthog ? posthog.get_explicit_consent_status() : "unavailable";
}

function withBrowserAnalytics(
  failureMessage: string,
  operation: (posthog: PostHog) => void,
): void {
  void browserAnalytics?.then((posthog) => {
    if (!posthog) {
      return;
    }

    try {
      operation(posthog);
    } catch (error) {
      console.error(failureMessage, errorName(error));
    }
  });
}

export function captureBrowserAnalyticsEvent<
  EventName extends AnalyticsEventName,
>(eventName: EventName, properties: AnalyticsEventMap[EventName]): void {
  const allowed = allowAnalyticsProperties(eventName, properties);
  if (!allowed) return;

  withBrowserAnalytics("PostHog browser event capture failed.", (posthog) =>
    posthog.capture(eventName, allowed),
  );
}

export function identifyAnalyticsUser(identity: AnalyticsIdentity): void {
  if (!browserAnalytics) {
    return;
  }

  const allowed = allowAnalyticsIdentity(identity);
  if (!allowed) return;

  latestIdentity = allowed;
  withBrowserAnalytics("PostHog browser identification failed.", (posthog) => {
    if (isGranted(posthog)) identify(posthog, allowed);
  });
}

// opt_in_capturing sends no $pageview while capture_pageview is off, so the
// page the member accepted on is captured here, after identify.
// The member waiting at the press, not one identified while the SDK loads.
export function grantAnalyticsConsent(): void {
  const identity = latestIdentity;
  withBrowserAnalytics("PostHog consent grant failed.", (posthog) => {
    posthog.opt_in_capturing();
    if (identity) identify(posthog, identity);
    posthog.capture("$pageview");
  });
}

export function denyAnalyticsConsent(): void {
  withBrowserAnalytics("PostHog consent denial failed.", (posthog) => {
    if (isGranted(posthog)) unlinkDevice(posthog);
    posthog.opt_out_capturing();
    // Opting out leaves the session manager's tab ID in sessionStorage.
    sessionStorage.removeItem(`ph_${posthog.config.token}_window_id`);
  });
}

// Another tab's choice arrives only through storage. posthog-js re-reads the
// key on every check, so this tab already captures under it; this identifies
// the member waiting here. "pending" is skipped: it is only the gap between a
// reset and its restore in that tab.
export function watchAnalyticsConsent(
  onChange: (consent: "granted" | "denied") => void,
): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== ANALYTICS_CONSENT_KEY) return;
    withBrowserAnalytics("PostHog consent sync failed.", (posthog) => {
      const consent = posthog.get_explicit_consent_status();
      if (consent === "pending") return;
      if (consent === "granted" && latestIdentity) {
        identify(posthog, latestIdentity);
      }
      onChange(consent);
    });
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

// Captured by BrowserPageview after the page's mount effects, so a reset,
// identify or cohort entry on that page always reaches PostHog first. Once per
// pathname in a row: Strict Mode mounts it twice in development.
export function captureBrowserPageview(pathname: string): void {
  if (pathname === lastPageviewPath) return;
  lastPageviewPath = pathname;

  withBrowserAnalytics("PostHog pageview capture failed.", (posthog) =>
    posthog.capture("$pageview"),
  );
}

// Per tab, never on the person: one member can hold different roles in two
// cohorts open side by side. The returned cleanup drops it on leaving.
export function enterAnalyticsCohort(cohort: AnalyticsCohort): () => void {
  const allowed = allowAnalyticsCohort(cohort);
  if (!allowed) return () => undefined;

  // Queued like captures, so an event sent before entry never carries it.
  const properties = {
    cohort_id: allowed.cohortId,
    cohort_role: allowed.cohortRole ?? null,
  };
  withBrowserAnalytics("PostHog cohort context failed.", () => {
    activeCohort = properties;
  });
  return () =>
    withBrowserAnalytics("PostHog cohort context failed.", () => {
      activeCohort = null;
    });
}

function attachActiveCohort(event: CaptureResult | null): CaptureResult | null {
  if (!event || !activeCohort) return event;
  return {
    ...event,
    properties: {
      ...event.properties,
      ...activeCohort,
      $groups: {
        ...event.properties.$groups,
        [COHORT_GROUP_TYPE]: activeCohort.cohort_id,
      },
    },
  };
}

export function resetAnalyticsUser(): void {
  latestIdentity = null;
  withBrowserAnalytics("PostHog browser identity reset failed.", forgetMember);
}

// Only an identified member is forgotten, so an invitee's anonymous visit
// still joins the login that follows it.
export function resetIdentifiedAnalyticsUser(): void {
  latestIdentity = null;
  withBrowserAnalytics("PostHog browser identity reset failed.", (posthog) => {
    if (isIdentified(posthog)) forgetMember(posthog);
  });
}

function isGranted(posthog: PostHog): boolean {
  return posthog.get_explicit_consent_status() === "granted";
}

function isIdentified(posthog: PostHog): boolean {
  return posthog.get_property("$user_state") === "identified";
}

function isIdentifiedAsAnother(posthog: PostHog, id: string): boolean {
  return isIdentified(posthog) && posthog.get_distinct_id() !== id;
}

function identify(posthog: PostHog, identity: AllowedAnalyticsIdentity): void {
  if (isIdentifiedAsAnother(posthog, identity.id)) forgetMember(posthog);
  posthog.identify(identity.id, { system_role: identity.systemRole });
}

// reset() also wipes the consent choice, so it goes back.
function forgetMember(posthog: PostHog): void {
  const consent = posthog.get_explicit_consent_status();
  unlinkDevice(posthog);
  restoreConsent(posthog, consent);
}

// A new device ID too, so the next person cannot be joined to this member
// through $device_id.
function unlinkDevice(posthog: PostHog): void {
  posthog.reset({ resetDeviceID: true });
}

// Without $opt_in, so a logout is not counted as a new acceptance.
function restoreConsent(posthog: PostHog, consent: AnalyticsConsent): void {
  if (consent === "granted") {
    posthog.opt_in_capturing({ captureEventName: false });
  }
  if (consent === "denied") posthog.opt_out_capturing();
}
