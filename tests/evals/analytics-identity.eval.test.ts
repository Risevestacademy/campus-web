// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { allowAnalyticsIdentity } from "@/core/analytics/events";
import { analyticsIdentityFor } from "@/features/auth/services/analytics-identity";
import type { Session } from "@/features/auth/types/auth.types";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const COHORT_LAYOUT = path.join(PROJECT_ROOT, "app/campus/[id]/layout.tsx");

const USER_ID = "55555555-5555-4555-8555-555555555555";
const COHORT_3 = "11111111-1111-4111-8111-111111111111";
const COHORT_4 = "22222222-2222-4222-8222-222222222222";

type CohortRole = Session["memberships"][number]["role"];

const place = (cohortId: string, role: CohortRole) => ({
  cohortId,
  role,
  cohort: { name: "Cohort 3", code: "C3" },
});

function session(
  systemRole: Session["user"]["systemRole"],
  memberships: Session["memberships"],
): Session {
  return {
    scope: "full_access",
    expiresAt: "2099-01-01T00:15:00.000Z",
    inviteId: null,
    user: {
      id: USER_ID,
      email: "ada@campus.local",
      displayName: "Ada Lovelace",
      systemRole,
    },
    memberships,
  };
}

const cases: [string, Session, string, string][] = [
  [
    "a student",
    session("user", [place(COHORT_3, "student")]),
    COHORT_3,
    "student",
  ],
  [
    "a mentor",
    session("user", [place(COHORT_3, "mentor")]),
    COHORT_3,
    "mentor",
  ],
  [
    "a member of several cohorts, in the visited one",
    session("user", [place(COHORT_3, "student"), place(COHORT_4, "professor")]),
    COHORT_4,
    "professor",
  ],
  ["an admin without a place", session("admin", []), COHORT_3, "admin"],
  [
    "a super admin without a place",
    session("super_admin", []),
    COHORT_3,
    "super_admin",
  ],
];

describe("Analytics identity eval (threshold: every case holds)", () => {
  it("identifies members inside the Cohort Gate, outside the keyed Presence Session", () => {
    const layout = readFileSync(COHORT_LAYOUT, "utf8");
    const gate = layout.indexOf("<CohortGate");
    const identity = layout.indexOf("<AnalyticsIdentity");
    const presenceOpen = layout.indexOf("<PresenceSession");
    const presenceClose = layout.indexOf("</PresenceSession>");

    expect(gate).toBeGreaterThanOrEqual(0);
    expect(identity).toBeGreaterThan(gate);
    expect(identity < presenceOpen || identity > presenceClose).toBe(true);
    expect(identity).toBeLessThan(layout.indexOf("</CohortGate>"));
  });

  it.each(cases)(
    "sends PostHog only the ID, cohort and role of %s",
    (_, viewer, cohortId, role) => {
      const sent = allowAnalyticsIdentity(
        analyticsIdentityFor(viewer, cohortId),
      );

      expect(sent).toStrictEqual({ id: USER_ID, cohortId, role });
      expect(JSON.stringify(sent)).not.toContain("@");
    },
  );
});
