import { describe, expect, it } from "vitest";

import type { Session } from "../types/auth.types";
import { memberAnalyticsFor, memberAnalyticsKey } from "./member-analytics";

const USER_ID = "55555555-5555-4555-8555-555555555555";
const COHORT_3 = "11111111-1111-4111-8111-111111111111";
const COHORT_4 = "22222222-2222-4222-8222-222222222222";

type Membership = Session["memberships"][number];

function session(
  systemRole: Session["user"]["systemRole"],
  memberships: Session["memberships"],
): Session {
  return {
    scope: "full_access",
    expiresAt: "2026-10-21T12:15:00.000Z",
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

const place = (cohortId: string, role?: Membership["role"]): Membership => ({
  cohortId,
  role,
  cohort: { name: cohortId, code: "C" },
});

describe("memberAnalyticsFor", () => {
  it("identifies a member by user ID and system role, with the visited cohort's role", () => {
    expect(
      memberAnalyticsFor(
        session("user", [place(COHORT_3, "student")]),
        COHORT_3,
      ),
    ).toEqual({
      identity: { id: USER_ID, systemRole: "user" },
      cohort: { cohortId: COHORT_3, cohortRole: "student" },
    });
  });

  it("takes the role from the visited cohort when the member has several", () => {
    const member = session("user", [
      place(COHORT_3, "student"),
      place(COHORT_4, "mentor"),
    ]);

    expect(memberAnalyticsFor(member, COHORT_4).cohort).toEqual({
      cohortId: COHORT_4,
      cohortRole: "mentor",
    });
  });

  it("keeps an admin's system role apart from their place in the cohort", () => {
    expect(
      memberAnalyticsFor(
        session("admin", [place(COHORT_3, "student")]),
        COHORT_3,
      ),
    ).toEqual({
      identity: { id: USER_ID, systemRole: "admin" },
      cohort: { cohortId: COHORT_3, cohortRole: "student" },
    });
  });

  it.each([
    ["an admin with no place in the cohort", session("admin", [])],
    [
      "a place whose role this build does not know",
      session("user", [place(COHORT_3)]),
    ],
  ])("sends no cohort role for %s", (_, viewer) => {
    expect(memberAnalyticsFor(viewer, COHORT_3).cohort.cohortRole).toBe(
      undefined,
    );
  });

  it("carries no name or email", () => {
    const analytics = memberAnalyticsFor(
      session("user", [place(COHORT_3, "guest")]),
      COHORT_3,
    );

    expect(JSON.stringify(analytics)).not.toMatch(/Ada|@/);
  });
});

describe("memberAnalyticsKey", () => {
  const student = memberAnalyticsFor(
    session("user", [place(COHORT_3, "student")]),
    COHORT_3,
  );

  it("is stable for the same member, cohort and roles", () => {
    expect(memberAnalyticsKey(student)).toBe(
      memberAnalyticsKey(
        memberAnalyticsFor(
          session("user", [place(COHORT_3, "student")]),
          COHORT_3,
        ),
      ),
    );
  });

  it.each([
    ["the cohort role", session("user", [place(COHORT_3, "mentor")]), COHORT_3],
    [
      "the system role",
      session("admin", [place(COHORT_3, "student")]),
      COHORT_3,
    ],
    ["the cohort", session("user", [place(COHORT_4, "student")]), COHORT_4],
    ["losing the place", session("user", []), COHORT_3],
  ])("changes with %s", (_, viewer, cohortId) => {
    expect(memberAnalyticsKey(memberAnalyticsFor(viewer, cohortId))).not.toBe(
      memberAnalyticsKey(student),
    );
  });
});
