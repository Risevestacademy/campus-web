"use client";

import { createContext, useContext } from "react";

export type SessionRefreshResult =
  | { kind: "refreshed"; expiresAt?: string }
  | { kind: "expired" }
  | { kind: "failed"; retryAfterMs?: number };

export type RefreshSession = () => Promise<SessionRefreshResult>;

const refuseRefresh: RefreshSession = async () => ({ kind: "expired" });

export const RefreshSessionContext =
  createContext<RefreshSession>(refuseRefresh);

export function useRefreshSession(): RefreshSession {
  return useContext(RefreshSessionContext);
}
