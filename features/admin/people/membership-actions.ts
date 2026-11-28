import type {
  MembershipEnd,
  PeopleViewer,
  Person,
  TrackOption,
} from "./types/people.types";

export interface MembershipActionsAvailable {
  // The tracks a student can be moved to: the cohort's others.
  moveTo: readonly TrackOption[];
  // A guest's current end, when their visit can be extended.
  visitEnds: string | null;
  ends: readonly MembershipEnd[];
}

export const NO_MEMBERSHIP_ACTIONS: MembershipActionsAvailable = {
  moveTo: [],
  visitEnds: null,
  ends: [],
};

const STUDENT_ENDS: readonly MembershipEnd[] = [
  "graduate",
  "defer",
  "withdraw",
  "dismiss",
  "remove",
];

// Mirrors what campus-api refuses: nothing on your own membership, a track
// move and the four student endings for students only, an extension for
// guests only, and removal for anyone. The list holds only live memberships,
// so none of them has already ended.
export function membershipActionsFor(
  viewer: Pick<PeopleViewer, "id">,
  person: Pick<Person, "id" | "role" | "trackId" | "accessExpiresAt">,
  tracks: readonly TrackOption[],
): MembershipActionsAvailable {
  if (viewer.id === person.id || !person.role) return NO_MEMBERSHIP_ACTIONS;

  switch (person.role) {
    case "student":
      return {
        moveTo: tracks.filter(({ id }) => id !== person.trackId),
        visitEnds: null,
        ends: STUDENT_ENDS,
      };
    case "guest":
      return {
        moveTo: [],
        visitEnds: person.accessExpiresAt,
        ends: ["remove"],
      };
    default:
      return { moveTo: [], visitEnds: null, ends: ["remove"] };
  }
}

export function hasMembershipActions(
  actions: MembershipActionsAvailable,
): boolean {
  return (
    actions.moveTo.length > 0 ||
    actions.visitEnds !== null ||
    actions.ends.length > 0
  );
}
