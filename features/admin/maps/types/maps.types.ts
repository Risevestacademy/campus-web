import type { Bounds } from "campus-world-map";

import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

type Schemas = components["schemas"];

export type SpaceKind = Schemas["SpaceKind"];
export type SpaceAccess = Schemas["SpaceAccess"];
export type AudioMode = Schemas["AudioMode"];

// What the published entry map draws, read from Sanity. Everything is in
// tiles, as campus-api stores it.
export interface MapShape {
  key: string;
  name: string;
  bounds: Bounds;
}

export interface MapDesk {
  key: string;
  x: number;
  y: number;
}

export interface PublishedEntryMap {
  mapKey: string;
  version: string;
  widthTiles: number;
  heightTiles: number;
  spaces: MapShape[];
  desks: MapDesk[];
  walls: Bounds[];
}

export type PublishedMapRead =
  | { kind: "loaded"; map: PublishedEntryMap }
  | { kind: "not-configured" }
  | { kind: "unavailable" };

// A map as campus-api holds it. `retiredAt` and `isEntry` are read only to
// choose the entry map; the page keeps what is left of that one.
export type CampusMapRow = Simplify<
  Pick<
    Schemas["MapResponseDto"],
    | "id"
    | "key"
    | "name"
    | "isEntry"
    | "retiredAt"
    | "syncedVersion"
    | "publishedVersion"
  >
>;
export type EntryMapRecord = Simplify<
  Pick<
    CampusMapRow,
    "id" | "key" | "name" | "syncedVersion" | "publishedVersion"
  >
>;
// `map` is null when campus-api holds no live entry map: nothing has been
// synced yet.
export type EntryMapRead =
  { kind: "loaded"; map: EntryMapRecord | null } | { kind: "unavailable" };

export type SpaceSettings = Simplify<
  Pick<
    Schemas["SpaceResponseDto"],
    | "id"
    | "mapId"
    | "key"
    | "name"
    | "kind"
    | "access"
    | "audioMode"
    | "capacity"
    | "isMapDefault"
  >
>;

export type SpacesRead =
  { kind: "loaded"; spaces: SpaceSettings[] } | { kind: "unavailable" };

export type SyncedSpace = Simplify<
  Pick<Schemas["SyncedSpaceDto"], "key" | "name" | "kind">
>;
export type MapSyncSpaces = Simplify<
  Pick<Schemas["MapSyncSpacesDto"], "restored" | "retired" | "needsKind"> & {
    added: SyncedSpace[];
  }
>;
export type MapSyncDesks = Simplify<
  Pick<Schemas["MapSyncDesksDto"], "added" | "restored" | "retired">
>;
export type MapSyncMap = Simplify<
  Pick<Schemas["MapSyncMapDto"], "outcome" | "key" | "isEntry"> & {
    spaces: MapSyncSpaces;
    desks: MapSyncDesks;
  }
>;
export type MapSyncResult = Simplify<
  Pick<Schemas["MapSyncResultDto"], "dryRun" | "changed"> & {
    maps: MapSyncMap[];
  }
>;

export type MapSyncProblem =
  | "busy"
  | "rejected"
  | "sanity-unreachable"
  | "not-configured"
  | "invalid"
  | "signed-out"
  | "forbidden"
  | "unavailable";
export type MapSyncOutcome =
  | { kind: "synced"; result: MapSyncResult }
  | { kind: "problem"; problem: MapSyncProblem; mapProblems: string[] };

export type MapPublishProblem =
  | "refused"
  | "missing"
  | "invalid"
  | "signed-out"
  | "forbidden"
  | "unavailable";
export type MapPublishOutcome =
  { kind: "published" } | { kind: "problem"; problem: MapPublishProblem };

// The fields this page edits. A request names only the ones that changed.
export type SpaceChanges = Simplify<
  Partial<
    Pick<
      Schemas["UpdateSpaceDto"],
      "name" | "kind" | "access" | "audioMode" | "capacity"
    >
  >
>;
export type SpaceUpdateProblem =
  | "invalid"
  | "kind-taken"
  | "missing"
  | "signed-out"
  | "forbidden"
  | "unavailable";
export type SpaceUpdateOutcome =
  { kind: "updated" } | { kind: "problem"; problem: SpaceUpdateProblem };

// Who a designated space admits: its grants, as a space's sheet lists them.
export type GrantSubjectType = Schemas["SpaceMembershipSubjectType"];
export type CohortRole = Schemas["CohortRole"];
export type SystemRole = Schemas["SystemRole"];

export type GrantSubject = Simplify<
  Pick<
    Schemas["SpaceMembershipSubjectDto"],
    | "type"
    | "displayName"
    | "email"
    | "trackName"
    | "cohortRole"
    | "systemRole"
    | "groupName"
  >
>;
export type SpaceGrant = Simplify<
  Pick<Schemas["SpaceMembershipResponseDto"], "id" | "live"> & {
    subject: GrantSubject;
  }
>;
export type SpaceGrantsRead =
  { kind: "loaded"; grants: SpaceGrant[] } | { kind: "unavailable" };

// What a grant names: exactly one subject.
export type GrantTarget =
  | { type: "user"; userId: string }
  | { type: "cohort_track"; cohortTrackId: string }
  | { type: "mentorship_group"; mentorshipGroupId: string }
  | { type: "cohort_role"; cohortRole: CohortRole };

// The cohort's tracks and mentorship groups a grant can name, read on the
// server with the page.
export interface GrantOption {
  id: string;
  name: string;
}
// Null when it couldn't be read, which the picker says rather than offering
// nothing.
export interface GrantOptions {
  tracks: GrantOption[] | null;
  groups: GrantOption[] | null;
}

export type SpaceGrantProblem =
  | "conflict"
  | "invalid"
  | "missing"
  | "signed-out"
  | "forbidden"
  | "unavailable";
export type SpaceGrantOutcome =
  { kind: "granted" } | { kind: "problem"; problem: SpaceGrantProblem };

export type EndGrantProblem =
  | "already-ended"
  | "missing"
  | "invalid"
  | "signed-out"
  | "forbidden"
  | "unavailable";
export type EndGrantOutcome =
  { kind: "ended" } | { kind: "problem"; problem: EndGrantProblem };
