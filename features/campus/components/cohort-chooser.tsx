import { cn } from "cn";
import Link from "next/link";
import type { ReactNode } from "react";

import type { ApiClient } from "@/core/api/client";
import { buttonVariants } from "@/shared/ui/button";

import { parseChooserPage } from "../schemas/cohort.schema";
import { listCohorts } from "../services/cohort.service";
import type { CohortSummary, CohortViewer } from "../types/cohort.types";
import { CohortCard } from "./cohort-card";
import { CreateCohortTile } from "./create-cohort-tile";

interface CohortChooserProps {
  viewer: CohortViewer;
  page: string | undefined;
  api: ApiClient;
}

function chooserHref(page: number) {
  return { pathname: "/campus", query: { page: String(page) } } as const;
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
const ADMIN_EMPTY =
  "No cohorts yet. Create the first one, then add its tracks before inviting students.";

function CohortGrid({
  cohorts,
  leading,
  emptyMessage,
}: {
  cohorts: CohortSummary[];
  leading?: ReactNode;
  emptyMessage: string;
}) {
  const isEmpty = cohorts.length === 0;

  return (
    <>
      {isEmpty ? (
        <p className="text-foreground-secondary text-pretty">{emptyMessage}</p>
      ) : null}
      {isEmpty && !leading ? null : (
        <ul className="flex flex-wrap gap-8">
          {leading ? <li>{leading}</li> : null}
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
          href={chooserHref(page - 1)}
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
          href={chooserHref(page + 1)}
          className={buttonVariants({ variant: "outline" })}
        >
          Next page
        </Link>
      ) : null}
    </nav>
  );
}

// A plain anchor so the retry is a full request through the session check.
function CohortsUnavailable({ page }: { page: number }) {
  return (
    <div className="grid justify-items-start gap-4">
      <p role="alert">We couldn&apos;t load the cohorts. Please try again.</p>
      <a
        href={`/campus?page=${page}`}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        Try again
      </a>
    </div>
  );
}

// Only admins read GET /v1/cohorts; members choose from their own session.
async function chooserContent({
  viewer,
  page,
  api,
}: Omit<CohortChooserProps, "page"> & { page: number }): Promise<ReactNode> {
  if (viewer.user.systemRole !== "admin") {
    return (
      <CohortGrid
        cohorts={membershipCohorts(viewer)}
        emptyMessage={MEMBER_EMPTY}
      />
    );
  }

  const cohorts = await listCohorts(api, page);
  if (cohorts.kind === "unavailable") return <CohortsUnavailable page={page} />;

  return (
    <div className="grid gap-8">
      <CohortGrid
        cohorts={cohorts.cohorts}
        leading={<CreateCohortTile page={cohorts.page} />}
        emptyMessage={ADMIN_EMPTY}
      />
      <CohortPagination page={cohorts.page} totalPages={cohorts.totalPages} />
    </div>
  );
}

// The caller supplies the API client so this entry point stays free of
// server-only modules; client code and tests import the same barrel.
export async function CohortChooser({ page, ...rest }: CohortChooserProps) {
  const content = await chooserContent({
    ...rest,
    page: parseChooserPage(page),
  });

  return (
    <section aria-labelledby="cohort-chooser-heading" className="grid gap-6">
      <h2 id="cohort-chooser-heading" className="text-lg font-medium">
        Choose a cohort
      </h2>
      {content}
    </section>
  );
}
