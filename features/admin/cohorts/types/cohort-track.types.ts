import type { TrackSummary } from "../../tracks/types/track.types";

export interface CohortTrackAssociation {
  id: string;
  track: TrackSummary;
}

export interface CohortTrackCollection {
  cohort: { id: string; name: string; code: string };
  tracks: CohortTrackAssociation[];
}

export type CohortTrackRead =
  | ({ kind: "loaded" } & CohortTrackCollection)
  | { kind: "missing" }
  | { kind: "unavailable" };

export type CohortTrackMutationProblem =
  | "invalid"
  | "signed-out"
  | "forbidden"
  | "missing"
  | "already-attached"
  | "in-use"
  | "unavailable";

export type CohortTrackAttachment =
  | { kind: "attached" }
  | { kind: "problem"; problem: CohortTrackMutationProblem };

export type CohortTrackDetachment =
  | { kind: "detached" }
  | { kind: "problem"; problem: CohortTrackMutationProblem };
