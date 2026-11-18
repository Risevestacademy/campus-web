import type { ReactNode } from "react";

import { renderWithAccess } from "./access-gate";

export async function CohortGate({
  cohortId,
  children,
}: {
  cohortId: string;
  children: ReactNode;
}) {
  return renderWithAccess({ kind: "cohort", cohortId }, children);
}
