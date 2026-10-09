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

export type CohortTrackRecordProblem =
  "invalid" | "signed-out" | "forbidden" | "missing" | "unavailable";
export type CohortTrackAttachmentProblem =
  CohortTrackRecordProblem | "already-attached";
export type CohortTrackDetachmentProblem = CohortTrackRecordProblem | "in-use";

export type CohortTrackAttachment =
  | { kind: "attached" }
  | { kind: "problem"; problem: CohortTrackAttachmentProblem };

export type CohortTrackDetachment =
  | { kind: "detached" }
  | { kind: "problem"; problem: CohortTrackDetachmentProblem };
