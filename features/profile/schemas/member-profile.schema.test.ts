// @vitest-environment node

import { describe, expect, it } from "vitest";

import type { MemberProfile } from "../types";
import {
  cardNameOf,
  parseMemberProfile,
  roleLineOf,
} from "./member-profile.schema";

const profile: MemberProfile = {
  id: "u-2",
  firstName: "Grace",
  lastName: "Hopper",
  displayName: "Grace H.",
  bio: "Compilers, mostly.",
  avatarUrl: "https://lh3.googleusercontent.com/a/grace",
  memberships: [
    { role: "student", cohort: { id: "c-1" }, track: { name: "Backend" } },
    { role: "mentor", cohort: { id: "c-2" }, track: null },
  ],
};

describe("parseMemberProfile", () => {
  it("keeps only the fields the card reads, never the email", () => {
    expect(
      parseMemberProfile({
        ...profile,
        email: "grace@campus.local",
        spriteKey: "placeholder-2",
        memberships: [
          {
            role: "student",
            cohort: { id: "c-1", name: "Cohort 2026", code: "C26" },
            track: { id: "t-1", name: "Backend", code: "BE" },
          },
          {
            role: "mentor",
            cohort: { id: "c-2", name: "Cohort 2025", code: "C25" },
            track: null,
          },
        ],
      }),
    ).toStrictEqual(profile);
  });

  it("draws no photo from an address that is not https", () => {
    expect(
      parseMemberProfile({ ...profile, avatarUrl: "http://example.test/a.png" })
        ?.avatarUrl,
    ).toBeNull();
  });

  it("reads a body it cannot use as nothing", () => {
    expect(parseMemberProfile({ id: "u-2" })).toBeUndefined();
  });
});

describe("cardNameOf", () => {
  it("names them by their display name", () => {
    expect(cardNameOf(profile, "Campus member")).toBe("Grace H.");
  });

  it("falls back to their full name, then to the caller's name", () => {
    expect(cardNameOf({ ...profile, displayName: " " }, "Campus member")).toBe(
      "Grace Hopper",
    );
    expect(
      cardNameOf(
        { ...profile, displayName: null, firstName: null, lastName: null },
        "Campus member",
      ),
    ).toBe("Campus member");
  });
});

describe("roleLineOf", () => {
  it("names their role and track in this cohort", () => {
    expect(roleLineOf(profile, "c-1")).toBe("Student · Backend");
  });

  it("names the role alone for one without a track", () => {
    expect(roleLineOf(profile, "c-2")).toBe("Mentor");
  });

  it("names nothing in a cohort the viewer shares no place with them in", () => {
    expect(roleLineOf(profile, "c-9")).toBeNull();
  });
});
