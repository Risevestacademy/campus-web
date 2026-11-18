import { CohortGate } from "@/features/auth";

import { requireCohortId } from "../../require-cohort-id";

export default async function ActiveCampusMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = await requireCohortId(params);

  return (
    <CohortGate cohortId={id}>
      <div className="grid place-content-center">
        <h1>ActiveCampusMeetingPage</h1>
      </div>
    </CohortGate>
  );
}
