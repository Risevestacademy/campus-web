"use client";

import { useSessionRenewal } from "../hooks/use-session-renewal";

export function SessionRenewalTimer({ expiresAt }: { expiresAt: string }) {
  useSessionRenewal(expiresAt);
  return null;
}
