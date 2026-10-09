import type { components } from "@/core/api/client";

export type CohortStatus = components["schemas"]["CohortStatus"];

export interface CohortFieldValues {
  name: string;
  code: string;
  startDate?: string;
  endDate?: string;
  status: CohortStatus;
}

export interface CohortSummary {
  id: string;
  name: string;
  code: string;
  startDate: string | null;
  endDate: string | null;
  status: CohortStatus;
}

export interface CohortPage {
  cohorts: CohortSummary[];
  page: number;
  totalPages: number;
}

export type CohortListRead =
  ({ kind: "loaded" } & CohortPage) | { kind: "unavailable" };

export type NewCohort = CohortFieldValues;
export type CohortFieldErrors = Partial<
  Record<keyof CohortFieldValues, string>
>;
export type NewCohortErrors = CohortFieldErrors;

export type NewCohortRead =
  | { kind: "valid"; cohort: NewCohort }
  | { kind: "invalid"; errors: NewCohortErrors };

export type CohortCreationProblem =
  "duplicate-code" | "rejected" | "signed-out" | "forbidden" | "unavailable";

export type CohortCreation =
  { kind: "created" } | { kind: "problem"; problem: CohortCreationProblem };

export type CohortPatch = components["schemas"]["UpdateCohortDto"];

export type CohortEditRead =
  | { kind: "valid"; changes: CohortPatch }
  | { kind: "invalid"; errors: CohortFieldErrors }
  | { kind: "unchanged" };

export type CohortMutationProblem =
  | "invalid"
  | "signed-out"
  | "forbidden"
  | "missing"
  | "conflict"
  | "unavailable";

export type CohortEdit =
  { kind: "updated" } | { kind: "problem"; problem: CohortMutationProblem };

export type CohortDeletion =
  { kind: "deleted" } | { kind: "problem"; problem: CohortMutationProblem };
