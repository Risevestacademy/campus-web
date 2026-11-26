import type { ApiClient } from "@/core/api/client";

import {
  type CreatedRoomLink,
  type LinkableSpace,
  parseCreatedRoomLink,
  parseLinkableSpacePage,
} from "../schemas/room-link.schema";

const PER_PAGE = 100;
// A campus has tens of spaces; this only stops a runaway answer.
const MAX_PAGES = 10;

export type LinkableSpacesRead =
  | { kind: "loaded"; spaces: readonly LinkableSpace[] }
  | { kind: "forbidden" }
  | { kind: "signed-out" }
  | { kind: "unavailable" };

// Every live space an admin may make a link for.
export async function readLinkableSpaces(
  api: ApiClient,
  signal?: AbortSignal,
): Promise<LinkableSpacesRead> {
  const spaces: LinkableSpace[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { data, response } = await api.GET("/v1/spaces", {
        params: { query: { page, perPage: PER_PAGE } },
        signal,
      });
      if (response.status === 401) return { kind: "signed-out" };
      if (response.status === 403) return { kind: "forbidden" };

      const read = response.ok ? parseLinkableSpacePage(data) : undefined;
      if (!read) return { kind: "unavailable" };
      spaces.push(...read.spaces);
      if (read.page >= read.totalPages) break;
    }
    return { kind: "loaded", spaces };
  } catch {
    return { kind: "unavailable" };
  }
}

export type RoomLinkProblem =
  "invalid" | "signed-out" | "forbidden" | "space-unavailable" | "unavailable";

export type RoomLinkCreation =
  | { kind: "created"; link: CreatedRoomLink }
  | { kind: "problem"; problem: RoomLinkProblem };

const PROBLEMS: Readonly<Partial<Record<number, RoomLinkProblem>>> = {
  400: "invalid",
  401: "signed-out",
  403: "forbidden",
  404: "space-unavailable",
};

// Makes a link for one event in one space. It is for the whole cohort: who is
// expected is not asked here.
export async function createRoomLink(
  api: ApiClient,
  cohortId: string,
  spaceId: string,
  title: string,
): Promise<RoomLinkCreation> {
  try {
    const { data, response } = await api.POST(
      "/v1/cohorts/{cohortId}/spaces/{spaceId}/links",
      {
        params: { path: { cohortId, spaceId } },
        body: { title, audience: "cohort" },
      },
    );
    if (!response.ok) {
      return {
        kind: "problem",
        problem: PROBLEMS[response.status] ?? "unavailable",
      };
    }
    const link = parseCreatedRoomLink(data);
    return link
      ? { kind: "created", link }
      : { kind: "problem", problem: "unavailable" };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
