import type { ApiClient } from "@/core/api/client";

import type {
  AssignableSystemRole,
  PersonRecordProblem,
  PersonReinstatement,
  PersonRoleChange,
  PersonSuspension,
  SuspendRequest,
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

// None of these read the response body: the page refreshes after a change,
// and the refreshed list is what shows the new role or status.
export async function setSystemRole(
  api: ApiClient,
  id: string,
  systemRole: AssignableSystemRole,
): Promise<PersonRoleChange> {
  try {
    const { response } = await api.PATCH("/v1/users/{id}/system-role", {
      params: { path: { id } },
      body: { systemRole },
    });
    if (response.ok) return { kind: "changed" };
    return {
      kind: "problem",
      problem: problemOf(response.status, "protected"),
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}

export async function suspendPerson(
  api: ApiClient,
  id: string,
  { reason }: SuspendRequest,
): Promise<PersonSuspension> {
  try {
    const { response } = await api.POST("/v1/users/{id}/suspend", {
      params: { path: { id } },
      body: reason ? { reason } : {},
    });
    if (response.ok) return { kind: "suspended" };
    return {
      kind: "problem",
      problem: problemOf(response.status, "already-suspended"),
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}

export async function reinstatePerson(
  api: ApiClient,
  id: string,
): Promise<PersonReinstatement> {
  try {
    const { response } = await api.POST("/v1/users/{id}/reinstate", {
      params: { path: { id } },
    });
    if (response.ok) return { kind: "reinstated" };
    return {
      kind: "problem",
      problem: problemOf(response.status, "not-suspended"),
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
