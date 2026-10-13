import { CohortGate, normalizeCohortReturnTo } from "@/features/auth";
import { CampusJoinButton, VisualsDisplay } from "@/features/campus";
import { CampusMapPreparationGate } from "@/features/campus-world";
import { firstSearchParameter } from "@/shared/lib/search-params";

interface JoinPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}

export default async function JoinPage({
  params,
  searchParams,
}: JoinPageProps) {
  const [{ id }, { returnTo }] = await Promise.all([params, searchParams]);
  const destination = normalizeCohortReturnTo(
    id,
    firstSearchParameter(returnTo),
  );

  return (
    <CohortGate cohortId={id}>
      <CampusMapPreparationGate>
        <main className="grid h-dvh content-center gap-6">
          <VisualsDisplay />

          <CampusJoinButton destination={destination} />
        </main>
      </CampusMapPreparationGate>
    </CohortGate>
  );
}
