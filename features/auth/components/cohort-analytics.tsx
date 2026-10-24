"use client";

import {
  enterAnalyticsCohort,
  identifyAnalyticsUser,
} from "@/core/analytics/client";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

import type { MemberAnalytics } from "../services/member-analytics";

export function CohortAnalytics({ identity, cohort }: MemberAnalytics) {
  useMountEffect(() => {
    identifyAnalyticsUser(identity);
    return enterAnalyticsCohort(cohort);
  });
  return null;
}
