import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

type Schemas = components["schemas"];

export type CohortRole = Schemas["CohortRole"];
export type StudentStatus = Schemas["StudentStatus"];
export type PeopleChip = "all" | CohortRole;
// Who the page lists: the people in the cohort now, or those who left it.
export type PeopleScope = "current" | "former";

export interface PeopleQuery {
  scope: PeopleScope;
  chip: PeopleChip;
  search: string | undefined;
  trackId: string | undefined;
  page: number;
}

type ListMembership = Simplify<
  Pick<Schemas["UserMembershipDto"], "role" | "accessExpiresAt"> & {
    cohort: Pick<Schemas["UserMembershipCohortDto"], "id">;
    track: Pick<Schemas["UserMembershipTrackDto"], "id" | "name"> | null;
  }
>;

// What `GET /v1/users` sends that the People page reads.
export type PersonListItem = Simplify<
  Pick<
    Schemas["UserListItemDto"],
    | "id"
    | "email"
    | "firstName"
    | "lastName"
    | "displayName"
    | "avatarUrl"
    | "systemRole"
    | "status"
  > & { memberships: ListMembership[] }
>;

export type PeopleListBody = Simplify<{
  items: PersonListItem[];
  meta: Pick<
    Schemas["PaginatedUserListItemDto"]["meta"],
    "page" | "totalPages" | "total"
  >;
}>;

export type Person = Simplify<
  Omit<PersonListItem, "memberships"> & {
    role: CohortRole | undefined;
    trackId: string | null;
    trackName: string | null;
    // Guests only: when the visit ends.
    accessExpiresAt: string | null;
  }
>;

export interface PeoplePage {
  people: Person[];
  page: number;
  totalPages: number;
  total: number;
}

export type PeopleListRead =
  ({ kind: "loaded" } & PeoplePage) | { kind: "unavailable" };

export type PeopleCountRead =
  { kind: "loaded"; total: number } | { kind: "unavailable" };

// What `GET /v1/cohorts/{id}/members?state=ended` sends that the Former
// members list reads. `id` is the membership's, so the person is `user.id`.
export type RosterMember = Simplify<
  Pick<
    Schemas["RosterMemberDto"],
    "role" | "status" | "dismissalReason" | "leftAt" | "accessExpiresAt"
  > & {
    user: Pick<
      Schemas["RosterUserDto"],
      "id" | "email" | "firstName" | "lastName" | "displayName" | "avatarUrl"
    >;
    track: Pick<Schemas["RosterTrackDto"], "name"> | null;
  }
>;

export type RosterBody = Simplify<{
  items: RosterMember[];
  meta: Pick<
    Schemas["PaginatedRosterMemberDto"]["meta"],
    "page" | "totalPages" | "total"
  >;
}>;

export interface FormerMembersPage {
  members: RosterMember[];
  page: number;
  totalPages: number;
  total: number;
}

export type FormerMembersRead =
  ({ kind: "loaded" } & FormerMembersPage) | { kind: "unavailable" };

export interface TrackOption {
  id: string;
  name: string;
}

export type TrackOptionsRead =
  { kind: "loaded"; tracks: TrackOption[] } | { kind: "unavailable" };

type CardMembership = Simplify<
  Pick<Schemas["ProfileCardMembershipDto"], "role"> & {
    cohort: Pick<Schemas["UserMembershipCohortDto"], "id" | "name">;
    track: Pick<Schemas["UserMembershipTrackDto"], "name"> | null;
  }
>;

// What `GET /v1/users/{id}/profile` sends that the person page reads.
export type PersonCard = Simplify<
  Pick<
    Schemas["ProfileCardDto"],
    "id" | "email" | "firstName" | "lastName" | "displayName" | "avatarUrl"
  > & { memberships: CardMembership[] }
>;

export type PersonCardRead =
  | { kind: "loaded"; card: PersonCard }
  | { kind: "missing" }
  | { kind: "unavailable" };

export type PersonRead =
  | { kind: "loaded"; person: Person; cohortName: string }
  | { kind: "missing" }
  | { kind: "unavailable" };

// The signed-in admin, as the People actions need them: their own row offers
// nothing, and only a super admin may suspend another super admin.
export type PeopleViewer = Pick<Schemas["SessionUserDto"], "id" | "systemRole">;

// `super_admin` is granted only by the seed, never through the API.
export type AssignableSystemRole = Schemas["SetSystemRoleDto"]["systemRole"];

export type PersonRecordProblem =
  "invalid" | "signed-out" | "forbidden" | "missing" | "unavailable";
// A 409: the account is a super admin's, or your own.
export type PersonRoleProblem = PersonRecordProblem | "protected";
// A 409: the account is already suspended, or is your own.
export type PersonSuspendProblem = PersonRecordProblem | "already-suspended";
// A 409: the account is not suspended.
export type PersonReinstateProblem = PersonRecordProblem | "not-suspended";

export type PersonRoleChange =
  { kind: "changed" } | { kind: "problem"; problem: PersonRoleProblem };
export type PersonSuspension =
  { kind: "suspended" } | { kind: "problem"; problem: PersonSuspendProblem };
export type PersonReinstatement =
  { kind: "reinstated" } | { kind: "problem"; problem: PersonReinstateProblem };

// What `POST /v1/users/{id}/suspend` takes from the form.
export type SuspendRequest = Simplify<
  Pick<Schemas["SuspendUserDto"], "reason">
>;

// A 409 on an ending: the membership has already ended, is not a student's
// for a student-only ending, or is the caller's own.
export type MembershipEndProblem = PersonRecordProblem | "not-endable";
// A 409 on a move: the membership has ended or is not a student's, the
// student is already on the track, or the cohort does not run it.
export type MembershipMoveProblem = PersonRecordProblem | "not-movable";
// A 409 on an extension: the membership has left, is not a guest's, or the
// visit has already ended.
export type VisitExtendProblem = PersonRecordProblem | "visit-ended";

// The four ways a student's place ends, and `remove`, which ends anyone's.
export type MembershipEnd =
  "graduate" | "defer" | "withdraw" | "dismiss" | "remove";

export type MembershipEnding =
  { kind: "ended" } | { kind: "problem"; problem: MembershipEndProblem };
export type MembershipTrackMove =
  { kind: "moved" } | { kind: "problem"; problem: MembershipMoveProblem };
export type GuestVisitExtension =
  { kind: "extended" } | { kind: "problem"; problem: VisitExtendProblem };

// What the end-membership endpoints take from the form.
export type EndMembershipRequest = Simplify<
  Pick<Schemas["EndMembershipDto"], "reason">
>;
export type MoveTrackRequest = Simplify<
  Pick<Schemas["MoveMemberTrackDto"], "trackId">
>;
export type ExtendVisitRequest = Simplify<
  Pick<Schemas["ExtendGuestVisitDto"], "accessExpiresAt">
>;
