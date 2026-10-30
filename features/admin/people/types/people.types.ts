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

type NamedUser = Pick<
  Schemas["UserListItemDto"],
  "id" | "email" | "firstName" | "lastName" | "displayName"
>;

export type Person = Simplify<
  NamedUser &
    Pick<Schemas["UserListItemDto"], "systemRole"> & {
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

export type PersonCard = Simplify<
  NamedUser & {
    memberships: {
      cohort: Pick<Schemas["UserMembershipCohortDto"], "id" | "name">;
      track: Pick<Schemas["UserMembershipTrackDto"], "name"> | null;
      role: CohortRole;
    }[];
  }
>;

export type PersonCardRead =
  | { kind: "loaded"; card: PersonCard }
  | { kind: "missing" }
  | { kind: "unavailable" };
