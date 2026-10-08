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
      : await CohortCatalogue({ page: String(query.page) });
  return (
    <section className="grid gap-8">
      <nav aria-label="Campus catalogues" className="flex gap-4">
        <Link
          href="/campus?view=cohorts&page=1"
          aria-current={query.view === "cohorts" ? "page" : undefined}
        >
          Cohorts
        </Link>
        <Link
          href="/campus?view=tracks&page=1"
          aria-current={query.view === "tracks" ? "page" : undefined}
        >
          Programme Tracks
        </Link>
      </nav>
      {catalogue}
    </section>
  );
}
