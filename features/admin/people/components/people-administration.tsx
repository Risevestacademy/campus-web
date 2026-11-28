import "server-only";

import Link from "next/link";

import { getServerApi } from "@/core/api/client/server";

import { CataloguePagination } from "../../catalogue/catalogue-presentation";
import { Notice } from "../../notice";
import { peopleHref } from "../people-href";
import { parsePeopleQuery } from "../schemas/people-query.schema";
import {
  loadPeopleView,
  type PeopleView,
} from "../services/people-view.service";
import type { PeopleQuery, PeopleViewer } from "../types/people.types";
import { PeopleChips, PeopleFilters } from "./people-filters";
import { PeopleTable } from "./people-table";

function PeopleList({
  cohortId,
  query,
  list,
  viewer,
}: {
  cohortId: string;
  query: PeopleQuery;
  list: PeopleView["list"];
  viewer: PeopleViewer;
}) {
  if (list.kind === "unavailable") {
    return (
      <Notice>
        We couldn&apos;t load people.{" "}
        <Link
          className="text-primary underline"
          href={peopleHref(cohortId, query)}
        >
          Try again
        </Link>
      </Notice>
    );
  }
  if (list.people.length === 0) {
    return <Notice>No one matches.</Notice>;
  }

  return (
    <>
      <PeopleTable cohortId={cohortId} people={list.people} viewer={viewer} />
      <CataloguePagination
        ariaLabel="People pages"
        hrefForPage={(page) => peopleHref(cohortId, { ...query, page })}
        page={list.page}
        totalPages={list.totalPages}
      />
    </>
  );
}

export function PeopleAdministrationView({
  cohortId,
  query,
  view,
  viewer,
}: {
  cohortId: string;
  query: PeopleQuery;
  view: PeopleView;
  viewer: PeopleViewer;
}) {
  return (
    <section
      aria-labelledby="people-heading"
      className="grid content-start gap-6 p-10"
    >
      <header>
        <h1 id="people-heading" className="font-display text-3xl font-semibold">
          People
        </h1>
      </header>

      <PeopleFilters cohortId={cohortId} query={query} tracks={view.tracks} />
      <PeopleChips cohortId={cohortId} query={query} counts={view.counts} />
      <PeopleList
        cohortId={cohortId}
        query={query}
        list={view.list}
        viewer={viewer}
      />
    </section>
  );
}

export async function PeopleAdministration({
  cohortId,
  rawQuery,
  viewer,
}: {
  cohortId: string;
  rawQuery: { role?: string; q?: string; track?: string; page?: string };
  viewer: PeopleViewer;
}) {
  const query = parsePeopleQuery(rawQuery);
  const view = await loadPeopleView(await getServerApi(), cohortId, query);

  return (
    <PeopleAdministrationView
      cohortId={cohortId}
      query={query}
      view={view}
      viewer={viewer}
    />
  );
}
