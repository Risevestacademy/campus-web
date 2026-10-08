export interface CohortSummary {
  id: string;
  name: string;
  code?: string;
}

// Shaped so an auth Session is assignable without features/campus importing
// features/auth.
export interface CohortViewer {
  memberships: ReadonlyArray<{
    cohortId: string;
    cohort: { name: string; code: string };
  }>;
}
