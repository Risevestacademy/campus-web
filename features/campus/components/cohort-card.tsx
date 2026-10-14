import { campusJoinHref } from "@/core/navigation";
import { CatalogueCardLink } from "@/shared/ui/catalogue-card-link";

import type { CohortSummary } from "../types/cohort.types";

export function CohortCard({ cohort }: { cohort: CohortSummary }) {
  return (
    <CatalogueCardLink
      href={campusJoinHref(cohort.id)}
      title={cohort.name}
      description={cohort.code}
    />
  );
}
