import {
  type AnalyticsConsent,
  denyAnalyticsConsent,
  grantAnalyticsConsent,
  readAnalyticsConsent,
} from "../client";

export type ConsentSnapshot = Readonly<{
  consent: AnalyticsConsent | "unknown" | "unavailable";
  reviewing: boolean;
}>;

const UNKNOWN: ConsentSnapshot = { consent: "unknown", reviewing: false };

let snapshot = UNKNOWN;
let reading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function subscribeToAnalyticsConsent(listener: () => void): () => void {
  listeners.add(listener);
  reading ??= readAnalyticsConsent().then((consent) => {
    if (snapshot.consent === "unknown") publish({ ...snapshot, consent });
  });
  return () => {
    listeners.delete(listener);
  };
}

export function getAnalyticsConsentSnapshot(): ConsentSnapshot {
  return snapshot;
}

export function getServerAnalyticsConsentSnapshot(): ConsentSnapshot {
  return UNKNOWN;
}

export function isConsentChoiceOpen({
  consent,
  reviewing,
}: ConsentSnapshot): boolean {
  if (consent === "unknown" || consent === "unavailable") return false;
  return consent === "pending" || reviewing;
}

export function openAnalyticsConsentChoices(): void {
  if (!snapshot.reviewing) publish({ ...snapshot, reviewing: true });
}

export function acceptAnalyticsConsent(): void {
  settle("granted", grantAnalyticsConsent);
}

export function rejectAnalyticsConsent(): void {
  settle("denied", denyAnalyticsConsent);
}

function settle(consent: "granted" | "denied", apply: () => void): void {
  if (snapshot.consent !== consent) apply();
  publish({ consent, reviewing: false });
}

function publish(next: ConsentSnapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}
