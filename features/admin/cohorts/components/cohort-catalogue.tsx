import "server-only";

import { cn } from "cn";
import Link from "next/link";

import { getServerApi } from "@/core/api/client/server";
import { buttonVariants } from "@/shared/ui/button";

import { parseChooserPage } from "../schemas/cohort.schema";
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

function CohortPagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Cohort pages" className="flex items-center gap-4">
      {page > 1 ? (
        <Link
          href={catalogueHref(page - 1)}
          className={buttonVariants({ variant: "outline" })}
        >
          Previous page
        </Link>
      ) : null}
      <span className="text-foreground-secondary text-sm">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={catalogueHref(page + 1)}
          className={buttonVariants({ variant: "outline" })}
        >
          Next page
        </Link>
      ) : null}
    </nav>
  );
}

function CohortsUnavailable({ page }: { page: number }) {
  return (
    <div className="grid justify-items-start gap-4">
      <p role="alert">We couldn&apos;t load the cohorts. Please try again.</p>
      <a
        href={`/campus?view=cohorts&page=${page}`}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        Try again
      </a>
    </div>
  );
}

export async function CohortCatalogue({ page }: { page: string | undefined }) {
  const requestedPage = parseChooserPage(page);
  const cohorts = await listCohorts(await getServerApi(), requestedPage);

  return (
    <section aria-labelledby="cohort-chooser-heading" className="grid gap-6">
      <h2 id="cohort-chooser-heading" className="text-lg font-medium">
        Choose a cohort
      </h2>
      {cohorts.kind === "unavailable" ? (
        <CohortsUnavailable page={requestedPage} />
      ) : (
        <div className="grid gap-8">
          <CohortGrid cohorts={cohorts.cohorts} page={cohorts.page} />
          <CohortPagination
            page={cohorts.page}
            totalPages={cohorts.totalPages}
          />
        </div>
      )}
    </section>
  );
}
