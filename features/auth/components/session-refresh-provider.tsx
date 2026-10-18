"use client";

import type { ReactNode } from "react";

import { RefreshSessionContext } from "@/core/session";

import { refreshSession } from "../services/browser-session";

// Gives other features auth's locked refresher, the one the refresh page uses.
export function SessionRefreshProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <RefreshSessionContext value={refreshSession}>
      {children}
    </RefreshSessionContext>
  );
}
