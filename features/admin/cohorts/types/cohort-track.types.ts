import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

import type { TrackSummary } from "../../tracks/types/track.types";

type Schemas = components["schemas"];

export type CohortTrackAssociation = Simplify<
  Pick<Schemas["CohortTrackResponseDto"], "id"> & { track: TrackSummary }
>;

export interface CohortTrackCollection {
  cohort: Pick<Schemas["CohortDetailResponseDto"], "id" | "name" | "code">;
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
