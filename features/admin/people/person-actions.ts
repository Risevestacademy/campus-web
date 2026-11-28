import type { PeopleViewer, Person } from "./types/people.types";

export interface PersonActionsAvailable {
  // The role the account would be given, when its role can change at all.
  roleChange: "admin" | "user" | undefined;
  suspend: boolean;
  reinstate: boolean;
}

const NONE: PersonActionsAvailable = {
  roleChange: undefined,
  suspend: false,
  reinstate: false,
};

// Mirrors what campus-api refuses, so the menu does not offer a sure refusal:
// nothing on your own account, no role change for a super admin, and only a
// super admin suspends another. Reinstating depends on who suspended the
// account, which the list does not send, so it is always offered and a 403
// says why it was refused.
export function personActionsFor(
  viewer: PeopleViewer,
  person: Pick<Person, "id" | "systemRole" | "status">,
): PersonActionsAvailable {
  if (viewer.id === person.id) return NONE;

  const superAdmin = person.systemRole === "super_admin";
  const suspended = person.status === "suspended";

  return {
    roleChange: superAdmin
      ? undefined
      : person.systemRole === "admin"
        ? "user"
        : "admin",
    suspend: !suspended && (!superAdmin || viewer.systemRole === "super_admin"),
    reinstate: suspended,
  };
}

export function hasPersonActions(actions: PersonActionsAvailable): boolean {
  return Boolean(actions.roleChange || actions.suspend || actions.reinstate);
}
