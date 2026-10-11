import { campusJoinHref } from "@/core/navigation";
import { CatalogueCardLink } from "@/shared/ui/catalogue-card-link";

import type { CohortSummary } from "../types/cohort.types";
import { CohortAdministrationActions } from "./cohort-administration-actions";

export function CohortAdministrationCard({
  cohort,
}: {
  cohort: CohortSummary;
}) {
  return (
    <article className="relative w-fit">
      <CatalogueCardLink
        href={campusJoinHref(cohort.id)}
        title={cohort.name}
        description={cohort.code}
        className="block pr-10"
      />
      <div className="absolute right-0 bottom-0">
        <CohortAdministrationActions cohort={cohort} />
      </div>
    </article>
  );
}
