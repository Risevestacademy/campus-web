"use client";

import { resetIdentifiedAnalyticsUser } from "@/core/analytics/client";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

// Sign-in and invitation pages are where a shared device changes hands,
// including after a cold expiry that never ran the renewal's reset.
export function ForgetPreviousMember() {
  useMountEffect(resetIdentifiedAnalyticsUser);
  return null;
}
