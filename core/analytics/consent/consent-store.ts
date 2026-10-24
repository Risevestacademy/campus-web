import {
  type AnalyticsConsent,
  denyAnalyticsConsent,
  grantAnalyticsConsent,
  readAnalyticsConsent,
  watchAnalyticsConsent,
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
  reading ??= startReading();
  return () => {
    listeners.delete(listener);
  };
}

function startReading(): Promise<void> {
  watchAnalyticsConsent((consent) => publish({ consent, reviewing: false }));
  return readAnalyticsConsent().then((consent) => {
    if (snapshot.consent === "unknown") publish({ ...snapshot, consent });
  });
}

export function getAnalyticsConsentSnapshot(): ConsentSnapshot {
  return snapshot;
}

export function getServerAnalyticsConsentSnapshot(): ConsentSnapshot {
  return UNKNOWN;
}

export function isConsentChoiceKnown({ consent }: ConsentSnapshot): boolean {
  return consent !== "unknown" && consent !== "unavailable";
}

export function isConsentChoiceOpen({
  consent,
  reviewing,
}: ConsentSnapshot): boolean {
  if (!isConsentChoiceKnown({ consent, reviewing })) return false;
  return consent === "pending" || reviewing;
}

// Before the stored choice is read there is nothing to review yet.
export function openAnalyticsConsentChoices(): void {
  if (snapshot.consent === "unknown" || snapshot.reviewing) return;
  publish({ ...snapshot, reviewing: true });
}

export function closeAnalyticsConsentChoices(): void {
  if (snapshot.reviewing) publish({ ...snapshot, reviewing: false });
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
