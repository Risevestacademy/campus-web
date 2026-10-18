import { CohortGate, normalizeCohortReturnTo } from "@/features/auth";
import {
  CampusJoinButton,
  PreJoinPresenceTab,
  VisualsDisplay,
} from "@/features/campus";
import { CampusMapPreparationGate } from "@/features/campus-world";
import { firstSearchParameter } from "@/shared/lib/search-params";

import { requireCohortId } from "../require-cohort-id";

interface JoinPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}

export default async function JoinPage({
  params,
  searchParams,
}: JoinPageProps) {
  const [id, { returnTo }] = await Promise.all([
    requireCohortId(params),
    searchParams,
  ]);
  const destination = normalizeCohortReturnTo(
    id,
    firstSearchParameter(returnTo),
  );

  return (
    <CohortGate cohortId={id}>
      <PreJoinPresenceTab destination={destination}>
        <CampusMapPreparationGate>
          <main className="grid h-dvh content-center gap-6">
            <VisualsDisplay />

            <CampusJoinButton destination={destination} />
          </main>
        </CampusMapPreparationGate>
      </PreJoinPresenceTab>
    </CohortGate>
  );
}
