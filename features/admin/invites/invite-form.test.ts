// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  addEmails,
  buildInviteRequests,
  fieldRulesFor,
  INVITE_ROLES,
  isValidEmail,
  MAX_EMAILS,
  splitEmails,
  validateInviteForm,
} from "./invite-form";
import type { InviteRole } from "./types/invite.types";

const COHORT = "c-1";

function values(overrides: {
  emails?: string[];
  role?: InviteRole;
  trackId?: string;
  groupId?: string;
}) {
  return {
    emails: ["ada@campus.local"],
    role: "student" as InviteRole,
    trackId: "ct-1",
    groupId: "",
    ...overrides,
  };
}

describe("field rules by role", () => {
  it("lets a student take a required track and an optional group", () => {
    expect(fieldRulesFor("student")).toEqual({
      track: "required",
      group: "optional",
    });
  });

  it("gives a professor an optional track and no group", () => {
    expect(fieldRulesFor("professor")).toEqual({
      track: "optional",
      group: "off",
    });
  });

  it("gives a mentor neither: no track, and campus-api allows a group on students only", () => {
    expect(fieldRulesFor("mentor")).toEqual({ track: "off", group: "off" });
  });

  it("gives an admin neither, since an admin is not placed in a cohort", () => {
    expect(fieldRulesFor("admin")).toEqual({ track: "off", group: "off" });
  });

  it("offers no guest and no super admin", () => {
    expect([...INVITE_ROLES]).toEqual([
      "student",
      "professor",
      "mentor",
      "admin",
    ]);
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

describe("validating the form", () => {
  it("passes a student with a track", () => {
    expect(validateInviteForm(values({}))).toBeUndefined();
  });

  it("asks for at least one email", () => {
    expect(validateInviteForm(values({ emails: [] }))?.emails).toBe(
      "Add at least one email.",
    );
  });

  it("names the addresses that look incomplete", () => {
    expect(
      validateInviteForm(values({ emails: ["ada@campus.local", "kemi@gmail"] }))
        ?.emails,
    ).toBe("Fix or remove: kemi@gmail");
  });

  it("caps one send and points to Bulk invite", () => {
    const many = Array.from(
      { length: MAX_EMAILS + 1 },
      (_, index) => `a${index}@c.io`,
    );

    expect(validateInviteForm(values({ emails: many }))?.emails).toContain(
      "Bulk invite",
    );
  });

  it("requires a track for a student only", () => {
    expect(validateInviteForm(values({ trackId: "" }))?.track).toBe(
      "Choose a track.",
    );
    expect(
      validateInviteForm(values({ role: "professor", trackId: "" })),
    ).toBeUndefined();
    expect(
      validateInviteForm(values({ role: "mentor", trackId: "" })),
    ).toBeUndefined();
    expect(
      validateInviteForm(values({ role: "admin", trackId: "" })),
    ).toBeUndefined();
  });
});

describe("building the requests", () => {
  it("places a student in the cohort with their track and group", () => {
    expect(buildInviteRequests(COHORT, values({ groupId: "g-1" }))).toEqual([
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
    expect(buildInviteRequests(COHORT, values({}))[0]).not.toHaveProperty(
      "mentorshipGroupId",
    );
  });

  it("never sends a group for a professor, even one chosen before the role changed", () => {
    expect(
      buildInviteRequests(
        COHORT,
        values({ role: "professor", groupId: "g-1" }),
      )[0],
    ).toEqual({
      email: "ada@campus.local",
      cohortId: COHORT,
      cohortRole: "professor",
      cohortTrackId: "ct-1",
    });
  });

  it("never sends a track or group for a mentor", () => {
    expect(
      buildInviteRequests(
        COHORT,
        values({ role: "mentor", groupId: "g-1" }),
      )[0],
    ).toEqual({
      email: "ada@campus.local",
      cohortId: COHORT,
      cohortRole: "mentor",
    });
  });

  it("sends an admin with no cohort at all", () => {
    expect(
      buildInviteRequests(COHORT, values({ role: "admin", groupId: "g-1" })),
    ).toEqual([{ email: "ada@campus.local", systemRole: "admin" }]);
  });

  it("makes one request per address", () => {
    expect(
      buildInviteRequests(
        COHORT,
        values({ emails: ["a@c.io", "b@c.io", "c@c.io"] }),
      ).map(({ email }) => email),
    ).toEqual(["a@c.io", "b@c.io", "c@c.io"]);
  });
});
