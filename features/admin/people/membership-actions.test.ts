import { describe, expect, it } from "vitest";

import {
  hasMembershipActions,
  membershipActionsFor,
} from "./membership-actions";
import type { Person, TrackOption } from "./types/people.types";

const VIEWER = { id: "me" };
const TRACKS: TrackOption[] = [
  { id: "t-1", name: "Backend" },
  { id: "t-2", name: "Design" },
];
const VISIT_END = "2026-12-05T12:00:00.000Z";

function member(
  role: Person["role"],
  overrides: Partial<Pick<Person, "id" | "trackId" | "accessExpiresAt">> = {},
) {
  return {
    id: "them",
    role,
    trackId: role === "student" ? "t-1" : null,
    accessExpiresAt: role === "guest" ? VISIT_END : null,
    ...overrides,
  };
}

describe("membershipActionsFor", () => {
  it("offers nothing on your own membership", () => {
    const actions = membershipActionsFor(
      VIEWER,
      member("student", { id: "me" }),
      TRACKS,
    );

    expect(hasMembershipActions(actions)).toBe(false);
  });

  it("offers nothing to someone with no place in this cohort", () => {
    expect(
      hasMembershipActions(
        membershipActionsFor(VIEWER, member(undefined), TRACKS),
      ),
    ).toBe(false);
  });

  it("moves a student only to the cohort's other tracks, and offers the four endings and removal", () => {
    expect(membershipActionsFor(VIEWER, member("student"), TRACKS)).toEqual({
      moveTo: [{ id: "t-2", name: "Design" }],
      visitEnds: null,
      ends: ["graduate", "defer", "withdraw", "dismiss", "remove"],
    });
  });

  it("does not offer a move when the cohort runs no other track", () => {
    expect(
      membershipActionsFor(VIEWER, member("student"), TRACKS.slice(0, 1))
        .moveTo,
    ).toEqual([]);
  });

  it("extends and removes a guest, and nothing else", () => {
    expect(membershipActionsFor(VIEWER, member("guest"), TRACKS)).toEqual({
      moveTo: [],
      visitEnds: VISIT_END,
      ends: ["remove"],
    });
  });

  it.each(["professor", "mentor"] as const)(
    "only removes a %s: the student endings and a move refuse staff",
    (role) => {
      expect(membershipActionsFor(VIEWER, member(role), TRACKS)).toEqual({
        moveTo: [],
        visitEnds: null,
        ends: ["remove"],
      });
    },
  );
});
