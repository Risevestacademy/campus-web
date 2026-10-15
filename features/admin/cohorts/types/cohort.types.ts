import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";
import type { FormErrors, FormInvalid } from "@/shared/lib/forms";

type Schemas = components["schemas"];

export type CohortStatus = Schemas["CohortStatus"];

export type CohortFieldValues = Schemas["CreateCohortDto"];

export type CohortSummary = Simplify<
  Pick<
    Schemas["CohortResponseDto"],
    "id" | "name" | "code" | "startDate" | "endDate" | "status"
  >
>;

export interface CohortPage {
  cohorts: CohortSummary[];
  page: number;
  totalPages: number;
}

export type CohortListRead =
  ({ kind: "loaded" } & CohortPage) | { kind: "unavailable" };

export type NewCohort = CohortFieldValues;
export type CohortFieldErrors = FormErrors<CohortFieldValues>;

export type NewCohortRead =
  { kind: "valid"; cohort: NewCohort } | FormInvalid<CohortFieldValues>;

export type CohortCreationProblem =
  "duplicate-code" | "rejected" | "signed-out" | "forbidden" | "unavailable";

export type CohortCreation =
  { kind: "created" } | { kind: "problem"; problem: CohortCreationProblem };

export type CohortPatch = Schemas["UpdateCohortDto"];

export type CohortEditRead =
  | { kind: "valid"; changes: CohortPatch }
  | FormInvalid<CohortFieldValues>
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
