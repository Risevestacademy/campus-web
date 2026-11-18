// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  addEmails,
  buildInviteRequests,
  INVITE_ROLES,
  type InviteFormData,
  inviteRoleLabel,
  isValidEmail,
  MAX_EMAILS,
  parseInviteRole,
  readInviteForm,
  splitEmails,
} from "./invite-form";

const COHORT = "c-1";

function data(overrides: Partial<InviteFormData> = {}): InviteFormData {
  return {
    emails: ["ada@campus.local"],
    role: "student",
    track: "ct-1",
    group: "",
    ...overrides,
  };
}

// The fields as the popup submits them: the emails in one hidden field.
function form(fields: Record<string, string | undefined> = {}): FormData {
  const all = {
    emails: "ada@campus.local",
    role: "student",
    track: "ct-1",
    group: "",
    ...fields,
  };
  const formData = new FormData();
  for (const [name, value] of Object.entries(all)) {
    if (value !== undefined) formData.set(name, value);
  }
  return formData;
}

describe("roles", () => {
  it("offers no guest and no super admin", () => {
    expect([...INVITE_ROLES]).toEqual([
      "student",
      "professor",
      "mentor",
      "admin",
    ]);
  });

  it("reads a role from text only when it is one the popup offers", () => {
    expect(parseInviteRole("mentor")).toBe("mentor");
    expect(parseInviteRole("guest")).toBeUndefined();
    expect(parseInviteRole("super_admin")).toBeUndefined();
    expect(parseInviteRole("")).toBeUndefined();
  });

  it("names the cohort roles as the rest of the admin does, and an admin as Admin", () => {
    expect(inviteRoleLabel("student")).toBe("Student");
    expect(inviteRoleLabel("admin")).toBe("Admin");
  });
});

describe("email parsing", () => {
  it("splits at commas, semicolons, spaces and lines, lower-cased, once each", () => {
    expect(
      splitEmails(
        "Ada@Campus.local, grace@campus.local;\nada@campus.local  lin@campus.local",
      ),
    ).toEqual(["ada@campus.local", "grace@campus.local", "lin@campus.local"]);
  });

  it("adds to what is already there without repeating it", () => {
    expect(
      addEmails(["ada@campus.local"], "ada@campus.local, b@campus.local"),
    ).toEqual(["ada@campus.local", "b@campus.local"]);
  });

  it("reads nothing from blanks", () => {
    expect(splitEmails("  ,; \n ")).toEqual([]);
  });

  it("knows a complete address from an incomplete one", () => {
    expect(isValidEmail("kemi.bello@gmail.com")).toBe(true);
    expect(isValidEmail("kemi.bello@gmail")).toBe(false);
    expect(isValidEmail("kemi.bello")).toBe(false);
  });
});

describe("reading the form", () => {
  it("passes a student with a track and gives the emails back as a list", () => {
    expect(
      readInviteForm(form({ emails: "Ada@Campus.local grace@campus.local" })),
    ).toEqual({
      kind: "valid",
      data: {
        emails: ["ada@campus.local", "grace@campus.local"],
        role: "student",
        track: "ct-1",
        group: "",
      },
    });
  });

  it("asks for at least one email", () => {
    expect(readInviteForm(form({ emails: "" }))).toMatchObject({
      kind: "invalid",
      errors: { emails: "Add at least one email." },
    });
  });

  it("asks to fix incomplete addresses without repeating them", () => {
    const read = readInviteForm(
      form({ emails: "ada@campus.local kemi@gmail" }),
    );

    expect(read).toMatchObject({
      kind: "invalid",
      errors: { emails: "Fix or remove the highlighted addresses." },
    });
    expect(JSON.stringify(read)).not.toContain("kemi@gmail");
  });

  it("caps one send and points to Bulk invite", () => {
    const many = Array.from(
      { length: MAX_EMAILS + 1 },
      (_, index) => `a${index}@c.io`,
    ).join(" ");

    expect(readInviteForm(form({ emails: many }))).toMatchObject({
      kind: "invalid",
      errors: { emails: expect.stringContaining("Bulk invite") },
    });
  });

  it("requires a track for a student only", () => {
    expect(readInviteForm(form({ track: "" }))).toMatchObject({
      kind: "invalid",
      errors: { track: "Choose a track." },
    });
    for (const role of ["professor", "mentor", "admin"]) {
      expect(readInviteForm(form({ role, track: "" })).kind).toBe("valid");
    }
  });

  it("reads a field the role does not show, which the browser leaves out, as empty", () => {
    expect(
      readInviteForm(
        form({ role: "mentor", track: undefined, group: undefined }),
      ),
    ).toMatchObject({ kind: "valid", data: { track: "", group: "" } });
  });

  it("refuses a role the popup does not offer", () => {
    expect(readInviteForm(form({ role: "guest" }))).toMatchObject({
      kind: "invalid",
      errors: { role: "Choose a role." },
    });
  });
});

describe("building the requests", () => {
  it("places a student in the cohort with their track and group", () => {
    expect(buildInviteRequests(COHORT, data({ group: "g-1" }))).toEqual([
      {
        email: "ada@campus.local",
        cohortId: COHORT,
        cohortRole: "student",
        cohortTrackId: "ct-1",
        mentorshipGroupId: "g-1",
      },
    ]);
  });

  it("sends no group when none is chosen", () => {
    expect(buildInviteRequests(COHORT, data())[0]).not.toHaveProperty(
      "mentorshipGroupId",
    );
  });

  it("never sends a group for a professor, even one chosen before the role changed", () => {
    expect(
      buildInviteRequests(COHORT, data({ role: "professor", group: "g-1" }))[0],
    ).toEqual({
      email: "ada@campus.local",
      cohortId: COHORT,
      cohortRole: "professor",
      cohortTrackId: "ct-1",
    });
  });

  it("sends a mentor's track but never a group", () => {
    expect(
      buildInviteRequests(
        COHORT,
        data({ role: "mentor", track: "ct-1", group: "g-1" }),
      )[0],
    ).toEqual({
      email: "ada@campus.local",
      cohortId: COHORT,
      cohortRole: "mentor",
      cohortTrackId: "ct-1",
    });
  });

  it("sends an admin with no cohort at all", () => {
    expect(
      buildInviteRequests(COHORT, data({ role: "admin", group: "g-1" })),
    ).toEqual([{ email: "ada@campus.local", systemRole: "admin" }]);
  });

  it("makes one request per address", () => {
    expect(
      buildInviteRequests(
        COHORT,
        data({ emails: ["a@c.io", "b@c.io", "c@c.io"] }),
      ).map(({ email }) => email),
    ).toEqual(["a@c.io", "b@c.io", "c@c.io"]);
  });
});
