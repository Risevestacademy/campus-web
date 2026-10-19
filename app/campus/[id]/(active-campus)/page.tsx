import { CohortGate } from "@/features/auth";
import { CampusWorld } from "@/features/campus-world";

import { requireCohortId } from "../require-cohort-id";

export default async function ActiveCampusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = await requireCohortId(params);

  return (
    <CohortGate cohortId={id}>
      <CampusWorld cohortId={id} />
    </CohortGate>
  );
}
