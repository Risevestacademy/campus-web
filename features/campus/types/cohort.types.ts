import type { components } from "@/core/api/client";

export interface CohortSummary {
  id: string;
  name: string;
  code?: string;
}

// Shaped so an auth Session is assignable without features/campus importing
// features/auth.
export interface CohortViewer {
  user: { systemRole: "user" | "admin" };
  memberships: ReadonlyArray<{
    cohortId: string;
    cohort: { name: string; code: string };
  }>;
}

export interface CohortPage {
  cohorts: CohortSummary[];
  page: number;
  totalPages: number;
}

export type CohortStatus = components["schemas"]["CohortStatus"];

export interface NewCohort {
  name: string;
  code: string;
  startDate?: string;
  endDate?: string;
  status: CohortStatus;
}

export type NewCohortErrors = Partial<Record<keyof NewCohort, string>>;

export type NewCohortRead =
  | { kind: "valid"; cohort: NewCohort }
  | { kind: "invalid"; errors: NewCohortErrors };

export type CohortCreationProblem =
  "duplicate-code" | "rejected" | "signed-out" | "unavailable";

export type CohortCreation =
  { kind: "created" } | { kind: "problem"; problem: CohortCreationProblem };
