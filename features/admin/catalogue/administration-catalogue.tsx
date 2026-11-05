import Link from "next/link";

import { CohortCatalogue } from "../cohorts/components/cohort-catalogue";
import { TrackCatalogue } from "../tracks/components/track-catalogue";
import { parseAdministrationQuery } from "./administration-query.schema";

export async function AdministrationCatalogue({
  view,
  page,
}: {
  view?: string;
  page?: string;
}) {
  const query = parseAdministrationQuery(view, page);
  const catalogue =
    query.view === "tracks"
      ? await TrackCatalogue({ page: query.page })
      : await CohortCatalogue({ page: query.page });
  return (
    <section className="grid gap-8">
      <nav
        aria-label="Campus catalogues"
        className="border-border flex gap-8 border-b dark:border-[#2B3B5F]"
      >
        <Link
          href="/campus?view=cohorts&page=1"
          className="text-foreground-secondary hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:text-primary dark:aria-[current=page]:text-cobalt-300 dark:aria-[current=page]:border-cobalt-300 -mb-px flex items-center gap-2 border-b-2 border-transparent px-1 pb-3 font-medium"
          aria-current={query.view === "cohorts" ? "page" : undefined}
        >
          Cohorts
        </Link>
        <Link
          href="/campus?view=tracks&page=1"
          className="text-foreground-secondary hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:text-primary dark:aria-[current=page]:text-cobalt-300 dark:aria-[current=page]:border-cobalt-300 -mb-px flex items-center gap-2 border-b-2 border-transparent px-1 pb-3 font-medium"
          aria-current={query.view === "tracks" ? "page" : undefined}
        >
          Programme Tracks
        </Link>
      </nav>
      {catalogue}
    </section>
  );
}
