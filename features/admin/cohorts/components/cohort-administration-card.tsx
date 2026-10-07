import Link from "next/link";

import type { CohortSummary } from "../types/cohort.types";

export function CohortAdministrationCard({
  cohort,
}: {
  cohort: CohortSummary;
}) {
  return (
    <Link
      href={`/campus/${encodeURIComponent(cohort.id)}`}
      className="group w-fit"
    >
      <figure className="bg-surface ring-border mb-2 block aspect-video w-80 rounded-2xl ring"></figure>
      <h3 className="line-clamp-1 pl-2 font-medium group-hover:underline">
        {cohort.name}
      </h3>
      {cohort.code ? (
        <p className="text-foreground-secondary pl-2 text-sm">{cohort.code}</p>
      ) : null}
    </Link>
  );
}
