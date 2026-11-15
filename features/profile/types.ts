import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";
import type { FormErrors, FormInvalid } from "@/shared/lib/forms";

type Schemas = components["schemas"];

type OwnMembership = Simplify<
  Pick<Schemas["UserMembershipDto"], "role"> & {
    cohort: Pick<Schemas["UserMembershipCohortDto"], "id" | "name">;
    track: Pick<Schemas["UserMembershipTrackDto"], "name"> | null;
  }
>;

// What `GET /v1/users/me` sends that the account menu and profile editor read.
export type OwnProfile = Simplify<
  Pick<
    Schemas["OwnProfileDto"],
    | "id"
    | "email"
    | "firstName"
    | "lastName"
    | "displayName"
    | "bio"
    | "phone"
    | "avatarUrl"
  > & { memberships: OwnMembership[] }
>;

type CardMembership = Simplify<
  Pick<Schemas["ProfileCardMembershipDto"], "role"> & {
    cohort: Pick<Schemas["UserMembershipCohortDto"], "id">;
    track: Pick<Schemas["UserMembershipTrackDto"], "name"> | null;
  }
>;

// What `GET /v1/users/{id}/profile` sends that another member's card reads.
export type MemberProfile = Simplify<
  Pick<
    Schemas["ProfileCardDto"],
    "id" | "firstName" | "lastName" | "displayName" | "bio" | "avatarUrl"
  > & { memberships: CardMembership[] }
>;

// `missing` is campus-api's 404: no such account, a suspended one, or one the
// viewer shares no cohort with.
export type MemberProfileRead =
  | { kind: "loaded"; profile: MemberProfile }
  | { kind: "missing" }
  | { kind: "signed-out" }
  | { kind: "unavailable" };

export type OwnProfileRead =
  | { kind: "loaded"; profile: OwnProfile }
  | { kind: "signed-out" }
  | { kind: "unavailable" };

export interface ProfileFieldValues {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  bio?: string;
  phone?: string;
}

export type ProfilePatch = Simplify<
  Pick<
    Schemas["UpdateProfileDto"],
    "firstName" | "lastName" | "displayName" | "bio" | "phone"
  >
>;

export type ProfileFieldErrors = FormErrors<ProfileFieldValues>;

export type ProfileEditRead =
  | { kind: "valid"; changes: ProfilePatch }
  | FormInvalid<ProfileFieldValues>
  | { kind: "unchanged" };

export type ProfileSaveProblem = "invalid" | "signed-out" | "unavailable";

export type ProfileSave =
  | { kind: "saved"; profile: OwnProfile }
  | { kind: "problem"; problem: ProfileSaveProblem };

export type ProfileSection = "profile" | "character";

// The account menu's one-line summary of the member in a cohort.
export interface OwnProfileSummary {
  // The member's Google photo, when they have one.
  avatarUrl: string | null;
  displayName: string | null;
  email: string;
  // "Track · Cohort", or the cohort alone for a role without a track; null
  // for an administrator who holds no place in the cohort.
  place: string | null;
}

// Why a picture change did not take: `expired` is campus-api's 404 (the
// upload is unknown, used or over 30 minutes old) and `mismatch` its 422 (the
// stored file is not what was signed for). Either way, upload it again.
export type AvatarProblem =
  "expired" | "mismatch" | "signed-out" | "unavailable";

export type AvatarChange =
  | { kind: "changed"; profile: OwnProfile }
  | { kind: "problem"; problem: AvatarProblem };
