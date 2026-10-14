import { browserApi } from "@/core/api/client/browser";

import { createSessionRefresher, type Serialize } from "./session.service";
import type { SharedExpiry } from "./session-renewal";

const SESSION_LOCK = "campus-session-renewal";
const SHARED_EXPIRY_KEY = "campus.session-expires-at";
const WINDOW_WAKE_EVENTS = ["focus", "online", "pageshow"] as const;

// Serialises refreshes across tabs. Web Locks need a secure context; without
// them the backend's 60 s reuse grace window absorbs a cross-tab race.
export const withSessionLock: Serialize = async (task) =>
  "locks" in navigator
    ? await navigator.locks.request(SESSION_LOCK, task)
    : task();

// The refresh page's request, shared by its soft-route remounts.
export const refreshSession = createSessionRefresher(
  browserApi,
  withSessionLock,
);

// Unlocked: Session Renewal takes the lock itself, because it must check other
// tabs' renewals under it and Web Locks are not reentrant.
export const renewSession = createSessionRefresher(browserApi);

function parseExpiry(value: string | null): number | undefined {
  const expiresAt = Number(value);
  return Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : undefined;
}

// Storage can be unavailable (private mode, blocked site data); renewal then
// loses only its cross-tab skip, never its own schedule.
export const sharedSessionExpiry: SharedExpiry & { clear(): void } = {
  read() {
    try {
      return parseExpiry(localStorage.getItem(SHARED_EXPIRY_KEY));
    } catch {
      return undefined;
    }
  },
  write(expiresAt) {
    try {
      localStorage.setItem(SHARED_EXPIRY_KEY, String(expiresAt));
    } catch {
      // Other tabs then renew on their own schedules.
    }
  },
  clear() {
    try {
      localStorage.removeItem(SHARED_EXPIRY_KEY);
    } catch {
      // Unavailable storage holds no stale expiry.
    }
  },
  subscribe(listener) {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SHARED_EXPIRY_KEY) return;
      const expiresAt = parseExpiry(event.newValue);
      if (expiresAt !== undefined) listener(expiresAt);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  },
};

// Timers stall while a device sleeps or a tab is frozen; these are the
// signals that the page is running again.
export function subscribeToWake(listener: () => void): () => void {
  const onVisible = () => {
    if (document.visibilityState === "visible") listener();
  };

  document.addEventListener("visibilitychange", onVisible);
  for (const event of WINDOW_WAKE_EVENTS) {
    window.addEventListener(event, listener);
  }

  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    for (const event of WINDOW_WAKE_EVENTS) {
      window.removeEventListener(event, listener);
    }
  };
}
