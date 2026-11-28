import type { ApiClient } from "@/core/api/client";

import type {
  EndMembershipRequest,
  ExtendVisitRequest,
  GuestVisitExtension,
  MembershipEnd,
  MembershipEnding,
  MembershipTrackMove,
  MoveTrackRequest,
  PersonRecordProblem,
} from "../types/people.types";

const COMMON_PROBLEMS: Readonly<Partial<Record<number, PersonRecordProblem>>> =
  {
    400: "invalid",
    401: "signed-out",
    403: "forbidden",
    404: "missing",
  };

// Each mutation names its own 409; every other status reads the same.
function problemOf<TConflict extends string>(
  status: number,
  conflict: TConflict,
): PersonRecordProblem | TConflict {
  if (status === 409) return conflict;
  return COMMON_PROBLEMS[status] ?? "unavailable";
}

interface Membership {
  cohortId: string;
  userId: string;
}

const END_PATHS = {
  graduate: "/v1/cohorts/{cohortId}/members/{userId}/graduate",
  defer: "/v1/cohorts/{cohortId}/members/{userId}/defer",
  withdraw: "/v1/cohorts/{cohortId}/members/{userId}/withdraw",
  dismiss: "/v1/cohorts/{cohortId}/members/{userId}/dismiss",
  remove: "/v1/cohorts/{cohortId}/members/{userId}/remove",
} as const satisfies Record<MembershipEnd, string>;

// None of these read the response body: the page refreshes after a change,
// and the refreshed list is what shows it. A 500 from an end means the
// member's sessions could not be ended, so nothing changed; it reads as
// unavailable, which says to try again.
export async function endMembership(
  api: ApiClient,
  end: MembershipEnd,
  { cohortId, userId }: Membership,
  { reason }: EndMembershipRequest,
): Promise<MembershipEnding> {
  try {
    const { response } = await api.POST(END_PATHS[end], {
      params: { path: { cohortId, userId } },
      body: reason ? { reason } : {},
    });
    if (response.ok) return { kind: "ended" };
    return {
      kind: "problem",
      problem: problemOf(response.status, "not-endable"),
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}

export async function moveMemberTrack(
  api: ApiClient,
  { cohortId, userId }: Membership,
  { trackId }: MoveTrackRequest,
): Promise<MembershipTrackMove> {
  try {
    const { response } = await api.PATCH(
      "/v1/cohorts/{cohortId}/members/{userId}/track",
      { params: { path: { cohortId, userId } }, body: { trackId } },
    );
    if (response.ok) return { kind: "moved" };
    return {
      kind: "problem",
      problem: problemOf(response.status, "not-movable"),
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}

export async function extendGuestVisit(
  api: ApiClient,
  { cohortId, userId }: Membership,
  { accessExpiresAt }: ExtendVisitRequest,
): Promise<GuestVisitExtension> {
  try {
    const { response } = await api.PATCH(
      "/v1/cohorts/{cohortId}/members/{userId}",
      { params: { path: { cohortId, userId } }, body: { accessExpiresAt } },
    );
    if (response.ok) return { kind: "extended" };
    return {
      kind: "problem",
      problem: problemOf(response.status, "visit-ended"),
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
