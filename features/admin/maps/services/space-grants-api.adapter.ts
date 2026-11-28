import type { ApiClient } from "@/core/api/client";

import { parseSpaceGrants } from "../schemas/space-grants.schema";
import type {
  EndGrantOutcome,
  EndGrantProblem,
  GrantTarget,
  SpaceGrantOutcome,
  SpaceGrantProblem,
  SpaceGrantsRead,
} from "../types/maps.types";

export async function listSpaceGrants(
  api: ApiClient,
  spaceId: string,
): Promise<SpaceGrantsRead> {
  try {
    const { data, response } = await api.GET("/v1/spaces/{id}/memberships", {
      params: { path: { id: spaceId } },
    });
    const grants = response.ok ? parseSpaceGrants(data) : undefined;
    return grants ? { kind: "loaded", grants } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

// The request names the one subject and nothing else.
function bodyOf(target: GrantTarget) {
  switch (target.type) {
    case "user":
      return { userId: target.userId };
    case "cohort_track":
      return { cohortTrackId: target.cohortTrackId };
    case "mentorship_group":
      return { mentorshipGroupId: target.mentorshipGroupId };
    case "cohort_role":
      return { cohortRole: target.cohortRole };
  }
}

const grantProblems: Readonly<Record<number, SpaceGrantProblem>> = {
  400: "invalid",
  401: "signed-out",
  403: "forbidden",
  404: "missing",
  409: "conflict",
};

export async function grantSpaceAccess(
  api: ApiClient,
  spaceId: string,
  target: GrantTarget,
): Promise<SpaceGrantOutcome> {
  try {
    const { response } = await api.POST("/v1/spaces/{id}/memberships", {
      params: { path: { id: spaceId } },
      body: bodyOf(target),
    });
    return response.ok
      ? { kind: "granted" }
      : {
          kind: "problem",
          problem: grantProblems[response.status] ?? "unavailable",
        };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}

const endProblems: Readonly<Record<number, EndGrantProblem>> = {
  400: "invalid",
  401: "signed-out",
  403: "forbidden",
  404: "missing",
  409: "already-ended",
};

export async function endSpaceGrant(
  api: ApiClient,
  spaceId: string,
  grantId: string,
): Promise<EndGrantOutcome> {
  try {
    const { response } = await api.DELETE(
      "/v1/spaces/{id}/memberships/{membershipId}",
      { params: { path: { id: spaceId, membershipId: grantId } } },
    );
    return response.ok
      ? { kind: "ended" }
      : {
          kind: "problem",
          problem: endProblems[response.status] ?? "unavailable",
        };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
