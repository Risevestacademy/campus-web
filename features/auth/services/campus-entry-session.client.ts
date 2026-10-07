"use client";

import {
  isCampusEntryCookie,
  serializeCampusEntryCookie,
  serializeExpiredCampusEntryCookies,
} from "./campus-entry-session";

function isSecureDocument(): boolean {
  return window.location.protocol === "https:";
}

export function rememberCampusEntry(cohortId: string): void {
  document.cookie = serializeCampusEntryCookie(cohortId, isSecureDocument());
}

export function clearCampusEntrySession(): void {
  const secure = isSecureDocument();

  for (const pair of document.cookie.split(";")) {
    const [name] = pair.trim().split("=", 1);
    if (name && isCampusEntryCookie(name)) {
      for (const expired of serializeExpiredCampusEntryCookies(name, secure)) {
        document.cookie = expired;
      }
    }
  }
}
