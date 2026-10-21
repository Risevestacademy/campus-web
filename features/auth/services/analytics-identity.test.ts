import { describe, expect, it } from "vitest";

import type { Session } from "../types/auth.types";
import { analyticsIdentityFor } from "./analytics-identity";

const COHORT_3 = "11111111-1111-4111-8111-111111111111";
const COHORT_4 = "22222222-2222-4222-8222-222222222222";

function session(
  systemRole: Session["user"]["systemRole"],
  memberships: Session["memberships"],
): Session {
  return {
    scope: "full_access",
    expiresAt: "2026-10-21T12:15:00.000Z",
    inviteId: null,
    user: {
      id: "55555555-5555-4555-8555-555555555555",
      email: "ada@campus.local",
      displayName: "Ada Lovelace",
      systemRole,
    },
    memberships,
  };
}

const place = (
  cohortId: string,
  role: Session["memberships"][number]["role"],
) => ({ cohortId, role, cohort: { name: cohortId, code: "C" } });

describe("analyticsIdentityFor", () => {
  it("identifies a member by their user ID and role in the visited cohort", () => {
    expect(
      analyticsIdentityFor(
        session("user", [place(COHORT_3, "student")]),
        COHORT_3,
      ),
    ).toEqual({
      id: "55555555-5555-4555-8555-555555555555",
      cohortId: COHORT_3,
      role: "student",
    });
  });

  it("takes the role from the visited cohort when the member has several", () => {
    const member = session("user", [
      place(COHORT_3, "student"),
      place(COHORT_4, "mentor"),
    ]);

    expect(analyticsIdentityFor(member, COHORT_4)).toMatchObject({
      cohortId: COHORT_4,
      role: "mentor",
    });
  });

  it("falls back to the system role for an admin with no place in the cohort", () => {
    expect(analyticsIdentityFor(session("admin", []), COHORT_3)).toMatchObject({
      cohortId: COHORT_3,
      role: "admin",
    });
  });

  it("carries no name or email", () => {
    const identity = analyticsIdentityFor(
      session("user", [place(COHORT_3, "student")]),
      COHORT_3,
    );

    expect(Object.keys(identity).sort()).toEqual(["cohortId", "id", "role"]);
  });
});
