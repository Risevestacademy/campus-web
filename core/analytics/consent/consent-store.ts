import {
  type AnalyticsConsent,
  denyAnalyticsConsent,
  grantAnalyticsConsent,
  readAnalyticsConsent,
  watchAnalyticsConsent,
} from "../client";

export type ConsentSnapshot = Readonly<{
  consent: AnalyticsConsent | "unknown" | "unavailable";
  // A made choice reopened from Privacy choices, or a hidden one shown again.
  reviewing: boolean;
  // A choice still to be made, hidden by Privacy choices without answering.
  dismissed: boolean;
}>;

const UNKNOWN: ConsentSnapshot = {
  consent: "unknown",
  reviewing: false,
  dismissed: false,
};

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
  watchAnalyticsConsent((consent) =>
    publish({ consent, reviewing: false, dismissed: false }),
  );
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

export function isConsentChoiceOpen(snapshot: ConsentSnapshot): boolean {
  if (!isConsentChoiceKnown(snapshot)) return false;
  return snapshot.consent === "pending"
    ? !snapshot.dismissed
    : snapshot.reviewing;
}

// Before the stored choice is read there is nothing to review yet.
export function openAnalyticsConsentChoices(): void {
  if (snapshot.consent === "unknown" || snapshot.reviewing) return;
  publish({ ...snapshot, reviewing: true });
}

// The Privacy choices switch: one press shows the choice, the next hides it.
// Hiding a choice that was never made leaves it pending, so nothing is
// granted, and the next press brings it back.
export function toggleAnalyticsConsentChoices(): void {
  if (!isConsentChoiceKnown(snapshot)) return;

  if (!isConsentChoiceOpen(snapshot)) {
    publish({ ...snapshot, reviewing: true, dismissed: false });
  } else if (snapshot.consent === "pending") {
    publish({ ...snapshot, reviewing: false, dismissed: true });
  } else {
    publish({ ...snapshot, reviewing: false });
  }
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
  publish({ consent, reviewing: false, dismissed: false });
}

function publish(next: ConsentSnapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}
