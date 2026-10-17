"use client";

import type { ReactNode } from "react";

import { RefreshSessionContext } from "@/shared/lib/session-refresh";

import { refreshSession } from "../services/browser-session";

async function renewsSession(): Promise<boolean> {
  try {
    return (await refreshSession()).kind === "refreshed";
  } catch {
    return false;
  }
}

// Gives other features auth's locked refresher, the one the refresh page uses.
export function SessionRefreshProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <RefreshSessionContext value={renewsSession}>
      {children}
    </RefreshSessionContext>
  );
}
