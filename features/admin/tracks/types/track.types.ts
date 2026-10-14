import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

type Schemas = components["schemas"];

export type TrackSummary = Simplify<
  Pick<Schemas["TrackResponseDto"], "id" | "name" | "code" | "description">
>;
export interface TrackPage {
  tracks: TrackSummary[];
  page: number;
  totalPages: number;
}
export type TrackListRead =
  ({ kind: "loaded" } & TrackPage) | { kind: "unavailable" };
export type TrackFieldValues = Schemas["CreateTrackDto"];
export type NewTrack = TrackFieldValues;
export type TrackPatch = Schemas["UpdateTrackDto"];
export type TrackFieldErrors = Partial<Record<keyof TrackFieldValues, string>>;
export type NewTrackRead =
  | { kind: "valid"; track: NewTrack }
  | { kind: "invalid"; errors: TrackFieldErrors; formError?: string };
export type TrackEditRead =
  | { kind: "valid"; changes: TrackPatch }
  | { kind: "invalid"; errors: TrackFieldErrors; formError?: string }
  | { kind: "unchanged" };
export type TrackCreationProblem =
  "duplicate-code" | "rejected" | "signed-out" | "forbidden" | "unavailable";
export type TrackCreation =
  { kind: "created" } | { kind: "problem"; problem: TrackCreationProblem };
export type TrackRecordProblem =
  "invalid" | "signed-out" | "forbidden" | "missing" | "unavailable";
export type TrackEditProblem = TrackRecordProblem | "duplicate-code";
export type TrackDeletionProblem = TrackRecordProblem | "attached";
export type TrackEdit =
  { kind: "updated" } | { kind: "problem"; problem: TrackEditProblem };
export type TrackDeletion =
  { kind: "deleted" } | { kind: "problem"; problem: TrackDeletionProblem };
