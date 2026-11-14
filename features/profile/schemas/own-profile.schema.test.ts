// @vitest-environment node

import { describe, expect, it } from "vitest";

import type { OwnProfile } from "../types";
import {
  parseOwnProfile,
  parseProfileEdit,
  summaryOf,
} from "./own-profile.schema";

const profile: OwnProfile = {
  id: "u-1",
  email: "ada@campus.local",
  firstName: "Ada",
  lastName: "Lovelace",
  displayName: "Ada L.",
  bio: null,
  phone: null,
  avatarUrl: "https://lh3.googleusercontent.com/a/example",
  memberships: [
    {
      role: "student",
      cohort: { id: "c-1", name: "Cohort 2026" },
      track: { name: "Backend" },
    },
    { role: "mentor", cohort: { id: "c-2", name: "Cohort 2025" }, track: null },
  ],
};

function formOf(fields: Record<string, string>) {
  const form = new FormData();
  for (const [field, value] of Object.entries(fields)) form.set(field, value);
  return form;
}

const unchangedForm = {
  firstName: "Ada",
  lastName: "Lovelace",
  displayName: "Ada L.",
  bio: "",
  phone: "",
};

describe("parseOwnProfile", () => {
  it("keeps only the fields the account menu and editor read", () => {
    expect(
      parseOwnProfile({
        ...profile,
        spriteKey: null,
        systemRole: "user",
        analyticsConsent: null,
        createdAt: "2026-09-22T12:00:00.000Z",
        memberships: [
          {
            role: "student",
            status: "active",
            accessExpiresAt: null,
            cohort: { id: "c-1", name: "Cohort 2026", code: "C26" },
            track: { id: "t-1", name: "Backend", code: "BE" },
          },
        ],
      }),
    ).toStrictEqual({ ...profile, memberships: [profile.memberships[0]] });
  });

  it("draws no photo from an address that is not https", () => {
    expect(
      parseOwnProfile({ ...profile, avatarUrl: "javascript:alert(1)" })
        ?.avatarUrl,
    ).toBeNull();
  });

  it("reads a body it cannot use as nothing", () => {
    expect(parseOwnProfile({ id: "u-1" })).toBeUndefined();
  });
});

describe("parseProfileEdit", () => {
  it("sends only the fields that changed, trimmed", () => {
    expect(
      parseProfileEdit(
        profile,
        formOf({ ...unchangedForm, displayName: "  Ada  ", bio: "Hi" }),
      ),
    ).toStrictEqual({
      kind: "valid",
      changes: { displayName: "Ada", bio: "Hi" },
    });
  });

  it("clears a field emptied in the form", () => {
    expect(
      parseProfileEdit(profile, formOf({ ...unchangedForm, lastName: " " })),
    ).toStrictEqual({ kind: "valid", changes: { lastName: null } });
  });

  it("says nothing changed when the form matches the profile", () => {
    expect(parseProfileEdit(profile, formOf(unchangedForm))).toStrictEqual({
      kind: "unchanged",
    });
  });

  it.each(["+234 (801) 234-5678", "08012345678"])(
    "takes the phone number %s",
    (phone) => {
      expect(
        parseProfileEdit(profile, formOf({ ...unchangedForm, phone })),
      ).toStrictEqual({ kind: "valid", changes: { phone } });
    },
  );

  it.each(["call me", "+", "080-CALL-ADA"])(
    "refuses the phone number %s without repeating it",
    (phone) => {
      const read = parseProfileEdit(
        profile,
        formOf({ ...unchangedForm, phone }),
      );

      expect(read.kind).toBe("invalid");
      expect(read.kind === "invalid" && read.errors.phone).toBe(
        "Use digits, with an optional + at the start and spaces or hyphens between them.",
      );
    },
  );
});

describe("summaryOf", () => {
  it("names the track and the cohort the member is in", () => {
    expect(summaryOf(profile, "c-1")).toStrictEqual({
      avatarUrl: "https://lh3.googleusercontent.com/a/example",
      displayName: "Ada L.",
      email: "ada@campus.local",
      place: "Backend · Cohort 2026",
    });
  });

  it("names the cohort alone for a role without a track", () => {
    expect(summaryOf(profile, "c-2").place).toBe("Cohort 2025");
  });

  it("names no place in a cohort the member holds none in", () => {
    expect(summaryOf(profile, "c-9").place).toBeNull();
  });
});
