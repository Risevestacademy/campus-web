import type { ApiClient } from "@/core/api/client";

import type { PersonRead } from "../types/people.types";
import { listPeople, readPersonCard } from "./people-api.adapter";

const MAX_PAGE_SIZE = 100;

// Reads one person as a member of one cohort. The profile card answers for
// any live account, so it cannot say whether the person belongs here; the
// cohort list is the only read that carries the account's role, and it has
// no filter by id, so the person is found in it by the card's address, page
// by page.
export async function readPerson(
  api: ApiClient,
  cohortId: string,
  userId: string,
): Promise<PersonRead> {
  const read = await readPersonCard(api, userId);
  if (read.kind !== "loaded") return read;

  const place = read.card.memberships.find(
    ({ cohort }) => cohort.id === cohortId,
  );
  if (!place) return { kind: "missing" };

  // The list has no filter by id and its search matches any part of an
  // address, so the person may be on a later page of the matches.
  for (let page = 1; ; page += 1) {
    const list = await listPeople(
      api,
      cohortId,
      { search: read.card.email },
      page,
      MAX_PAGE_SIZE,
    );
    if (list.kind !== "loaded") return { kind: "unavailable" };

    const person = list.people.find(({ id }) => id === userId);
    if (person) {
      return { kind: "loaded", person, cohortName: place.cohort.name };
    }
    if (page >= list.totalPages) return { kind: "unavailable" };
  }
}
