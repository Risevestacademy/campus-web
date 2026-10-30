import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

type Schemas = components["schemas"];

export type CohortRole = Schemas["CohortRole"];
export type PeopleChip = "all" | CohortRole;

export interface PeopleQuery {
  chip: PeopleChip;
  search: string | undefined;
  trackId: string | undefined;
  page: number;
}

type ListMembership = Simplify<
  Pick<Schemas["UserMembershipDto"], "role"> & {
    cohort: Pick<Schemas["UserMembershipCohortDto"], "id">;
    track: Pick<Schemas["UserMembershipTrackDto"], "name"> | null;
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
    trackName: string | null;
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
    "id" | "email" | "firstName" | "lastName" | "displayName"
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
