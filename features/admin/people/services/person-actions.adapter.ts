import type { ApiClient } from "@/core/api/client";

import type {
  AssignableSystemRole,
  PersonAction,
  PersonActionProblem,
  SuspendRequest,
} from "../types/people.types";

const PROBLEMS: Readonly<Partial<Record<number, PersonActionProblem>>> = {
  400: "invalid",
  401: "signed-out",
  403: "forbidden",
  404: "missing",
  409: "conflict",
};

function outcomeOf(response: Response): PersonAction {
  if (response.ok) return { kind: "done" };
  return {
    kind: "problem",
    problem: PROBLEMS[response.status] ?? "unavailable",
  };
}

// None of these read the response body: the page refreshes after a change,
// and the refreshed list is what shows the new role or status.
export async function setSystemRole(
  api: ApiClient,
  id: string,
  systemRole: AssignableSystemRole,
): Promise<PersonAction> {
  try {
    const { response } = await api.PATCH("/v1/users/{id}/system-role", {
      params: { path: { id } },
      body: { systemRole },
    });
    return outcomeOf(response);
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}

export async function suspendPerson(
  api: ApiClient,
  id: string,
  { reason }: SuspendRequest,
): Promise<PersonAction> {
  try {
    const { response } = await api.POST("/v1/users/{id}/suspend", {
      params: { path: { id } },
      body: reason ? { reason } : {},
    });
    return outcomeOf(response);
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}

export async function reinstatePerson(
  api: ApiClient,
  id: string,
): Promise<PersonAction> {
  try {
    const { response } = await api.POST("/v1/users/{id}/reinstate", {
      params: { path: { id } },
    });
    return outcomeOf(response);
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
