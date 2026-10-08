import Link from "next/link";

import type { CohortSummary } from "../types/cohort.types";
import { CohortAdministrationActions } from "./cohort-administration-actions";

export function CohortAdministrationCard({
  cohort,
}: {
  cohort: CohortSummary;
}) {
  return (
    <article className="relative w-fit">
      <Link
        href={`/campus/${encodeURIComponent(cohort.id)}`}
        className="group block w-fit pr-10"
      >
        <figure className="bg-surface ring-border mb-2 block aspect-video w-80 rounded-2xl ring"></figure>
        <h3 className="line-clamp-1 pl-2 font-medium group-hover:underline">
          {cohort.name}
        </h3>
        <p className="text-foreground-secondary pl-2 text-sm">{cohort.code}</p>
      </Link>
      <div className="absolute right-0 bottom-0">
        <CohortAdministrationActions cohort={cohort} />
      </div>
    </article>
  );
}
