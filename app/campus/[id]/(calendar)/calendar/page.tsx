import { CohortGate } from "@/features/auth";
import {
  CALENDAR_OUTCOME_PARAMETER,
  CalendarOutcomeNotice,
  CalendarPage,
  parseConnectOutcome,
} from "@/features/calendar";
import { firstSearchParameter } from "@/shared/lib/search-params";

import { requireCohortId } from "../../require-cohort-id";

export default async function CohortCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const id = await requireCohortId(params);
  const outcome = parseConnectOutcome(
    firstSearchParameter((await searchParams)[CALENDAR_OUTCOME_PARAMETER]),
  );

  return (
    <CohortGate cohortId={id}>
      {outcome ? <CalendarOutcomeNotice outcome={outcome} /> : null}
      <CalendarPage />
    </CohortGate>
  );
}
