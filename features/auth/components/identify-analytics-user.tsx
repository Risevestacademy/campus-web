"use client";

import type { AnalyticsIdentity } from "@/core/analytics";
import { identifyAnalyticsUser } from "@/core/analytics/client";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

export function IdentifyAnalyticsUser({
  identity,
}: {
  identity: AnalyticsIdentity;
}) {
  useMountEffect(() => identifyAnalyticsUser(identity));
  return null;
}
