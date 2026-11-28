import { describe, expect, it } from "vitest";

import { personActionsFor } from "./person-actions";
import type { PeopleViewer, Person } from "./types/people.types";

const ADMIN: PeopleViewer = { id: "me", systemRole: "admin" };
const SUPER: PeopleViewer = { id: "me", systemRole: "super_admin" };

function target(
  systemRole: Person["systemRole"],
  status: Person["status"] = "active",
): Pick<Person, "id" | "systemRole" | "status"> {
  return { id: "them", systemRole, status };
}

describe("personActionsFor", () => {
  it("offers nothing on your own account", () => {
    expect(personActionsFor(SUPER, { ...target("admin"), id: "me" })).toEqual({
      roleChange: undefined,
      suspend: false,
      reinstate: false,
    });
  });

  it("makes a user an admin and takes it back from an admin", () => {
    expect(personActionsFor(ADMIN, target("user")).roleChange).toBe("admin");
    expect(personActionsFor(ADMIN, target("admin")).roleChange).toBe("user");
  });

  it("never changes a super admin's role, whoever asks", () => {
    expect(personActionsFor(SUPER, target("super_admin")).roleChange).toBe(
      undefined,
    );
  });

  it("lets only a super admin suspend a super admin", () => {
    expect(personActionsFor(ADMIN, target("super_admin")).suspend).toBe(false);
    expect(personActionsFor(SUPER, target("super_admin")).suspend).toBe(true);
    expect(personActionsFor(ADMIN, target("admin")).suspend).toBe(true);
  });

  it("offers Reinstate instead of Suspend once suspended", () => {
    expect(personActionsFor(ADMIN, target("user", "suspended"))).toMatchObject({
      suspend: false,
      reinstate: true,
    });
    expect(personActionsFor(ADMIN, target("user"))).toMatchObject({
      suspend: true,
      reinstate: false,
    });
  });
});
