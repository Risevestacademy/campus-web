import type { CohortSummary, CohortViewer } from "../types/cohort.types";
import { CohortCard } from "./cohort-card";

interface CohortChooserProps {
  viewer: CohortViewer;
}

function membershipCohorts(viewer: CohortViewer): CohortSummary[] {
  return viewer.memberships.map(({ cohortId, cohort }) => ({
    id: cohortId,
    name: cohort.name,
    code: cohort.code,
  }));
}

const MEMBER_EMPTY =
  "You're not in a cohort yet. Ask your programme admin for an invite.";

function CohortGrid({ cohorts }: { cohorts: CohortSummary[] }) {
  const isEmpty = cohorts.length === 0;

  return (
    <>
      {isEmpty ? (
        <p className="text-foreground-secondary text-pretty">{MEMBER_EMPTY}</p>
      ) : null}
      {isEmpty ? null : (
        <ul className="flex flex-wrap gap-8">
          {cohorts.map((cohort) => (
            <li key={cohort.id}>
              <CohortCard cohort={cohort} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function CohortChooser({ viewer }: CohortChooserProps) {
  return (
    <section aria-labelledby="cohort-chooser-heading" className="grid gap-6">
      <h2 id="cohort-chooser-heading" className="text-lg font-medium">
        Choose a cohort
      </h2>
      <CohortGrid cohorts={membershipCohorts(viewer)} />
    </section>
  );
}
