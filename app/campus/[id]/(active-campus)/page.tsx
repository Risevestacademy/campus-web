import { CohortGate } from "@/features/auth";
import {
  CampusWorld,
  parseWalkTargetSpace,
  WalkOnArrival,
} from "@/features/campus-world";
import { firstSearchParameter } from "@/shared/lib/search-params";

import { requireCohortId } from "../require-cohort-id";

export default async function ActiveCampusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ goToSpace?: string | string[] }>;
}) {
  const [id, { goToSpace }] = await Promise.all([
    requireCohortId(params),
    searchParams,
  ]);
  const spaceKey = parseWalkTargetSpace(firstSearchParameter(goToSpace));

  return (
    <CohortGate cohortId={id}>
      <CampusWorld cohortId={id} />
      {spaceKey ? <WalkOnArrival cohortId={id} spaceKey={spaceKey} /> : null}
    </CohortGate>
  );
}
