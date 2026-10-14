import "server-only";

import { getServerApi } from "@/core/api/client/server";

import {
  CataloguePagination,
  CatalogueUnavailable,
} from "../../catalogue/catalogue-presentation";
import { listCohorts } from "../services/cohort-api.adapter";
import type { CohortSummary } from "../types/cohort.types";
import { CohortAdministrationCard } from "./cohort-administration-card";
import { CreateCohortTile } from "./create-cohort-tile";

const EMPTY_CATALOGUE =
  "No cohorts yet. Create the first one, then add its tracks before inviting students.";

function catalogueHref(page: number) {
  return {
    pathname: "/campus",
    query: { view: "cohorts", page: String(page) },
  } as const;
}

function CohortGrid({
  cohorts,
  page,
}: {
  cohorts: CohortSummary[];
  page: number;
}) {
  return (
    <>
      {cohorts.length === 0 ? (
        <p className="text-foreground-secondary text-pretty">
          {EMPTY_CATALOGUE}
        </p>
      ) : null}
      <ul className="flex flex-wrap gap-8">
        <li>
          <CreateCohortTile page={page} />
        </li>
        {cohorts.map((cohort) => (
          <li key={cohort.id}>
            <CohortAdministrationCard cohort={cohort} />
          </li>
        ))}
      </ul>
    </>
  );
}

export async function CohortCatalogue({ page }: { page: number }) {
  const cohorts = await listCohorts(await getServerApi(), page);

  return (
    <section aria-labelledby="cohort-chooser-heading" className="grid gap-6">
      <h2 id="cohort-chooser-heading" className="text-lg font-medium">
        Choose a cohort
      </h2>
      {cohorts.kind === "unavailable" ? (
        <CatalogueUnavailable retryHref={`/campus?view=cohorts&page=${page}`}>
          We couldn&apos;t load the cohorts. Please try again.
        </CatalogueUnavailable>
      ) : (
        <div className="grid gap-8">
          <CohortGrid cohorts={cohorts.cohorts} page={cohorts.page} />
          <CataloguePagination
            ariaLabel="Cohort pages"
            hrefForPage={catalogueHref}
            page={cohorts.page}
            totalPages={cohorts.totalPages}
          />
        </div>
      )}
    </section>
  );
}
