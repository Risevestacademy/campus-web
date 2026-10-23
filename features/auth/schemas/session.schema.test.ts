import { describe, expect, it } from "vitest";

import { parseRefreshExpiry, parseSessionBody } from "./session.schema";

const sessionDto = {
  scope: "full_access",
  expiresAt: "2026-10-02T12:15:00.000Z",
  inviteId: null,
  user: {
    id: "55555555-5555-4555-8555-555555555555",
    email: "ada@campus.local",
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: "Ada Lovelace",
    avatarUrl: "https://lh3.googleusercontent.com/a/example",
    systemRole: "user",
  },
  membership: { cohortId: "c-1", role: "student" },
  memberships: [
    {
      cohortId: "c-1",
      role: "student",
      cohort: { name: "Cohort 3", code: "C3" },
    },
  ],
};

function body(value: unknown): string {
  return JSON.stringify(value);
}

describe("parseSessionBody", () => {
  it("keeps only the fields routes and screens read", () => {
    expect(parseSessionBody(body(sessionDto))).toStrictEqual({
      scope: "full_access",
      expiresAt: "2026-10-02T12:15:00.000Z",
      inviteId: null,
      user: {
        id: "55555555-5555-4555-8555-555555555555",
        email: "ada@campus.local",
        displayName: "Ada Lovelace",
        systemRole: "user",
      },
      memberships: [
        {
          cohortId: "c-1",
          role: "student",
          cohort: { name: "Cohort 3", code: "C3" },
        },
      ],
    });
  });

  it("drops a field the backend adds later", () => {
    const session = parseSessionBody(
      body({ ...sessionDto, user: { ...sessionDto.user, phone: "+234" } }),
    );

    expect(session?.user).not.toHaveProperty("phone");
  });

  it("never copies a __proto__ key onto the session", () => {
    const session = parseSessionBody(
      `{"__proto__":{"polluted":true},${body(sessionDto).slice(1)}`,
    );

    expect(session).toBeDefined();
    expect(Object.getPrototypeOf(session)).toBe(Object.prototype);
    expect(session).not.toHaveProperty("polluted");
  });

  it.each([
    ["no body", undefined],
    ["invalid JSON", "{not json"],
    ["an unknown scope", body({ ...sessionDto, scope: "root" })],
    [
      "a display name that is not text",
      body({ ...sessionDto, user: { ...sessionDto.user, displayName: 42 } }),
    ],
    [
      "an expiry without seconds",
      body({ ...sessionDto, expiresAt: "2026-10-02T12:15Z" }),
    ],
    [
      "memberships that are not a list",
      body({ ...sessionDto, memberships: null }),
    ],
    [
      "a user without an id",
      body({ ...sessionDto, user: { ...sessionDto.user, id: "" } }),
    ],
  ])("rejects %s", (_, value) => {
    expect(parseSessionBody(value)).toBeUndefined();
  });

  it("keeps the session and drops a cohort role this build does not know", () => {
    const session = parseSessionBody(
      body({
        ...sessionDto,
        memberships: [{ ...sessionDto.memberships[0], role: "owner" }],
      }),
    );

    expect(session?.memberships).toEqual([
      { cohortId: "c-1", cohort: { name: "Cohort 3", code: "C3" } },
    ]);
  });
});

describe("parseRefreshExpiry", () => {
  it("reads the renewed expiry and nothing else", () => {
    expect(
      parseRefreshExpiry(
        body({ expiresAt: "2026-10-02T12:30:00.000Z", refreshToken: "secret" }),
      ),
    ).toBe("2026-10-02T12:30:00.000Z");
  });

  it.each([undefined, "", "{}", body({ expiresAt: "soon" })])(
    "returns undefined for %j",
    (value) => {
      expect(parseRefreshExpiry(value)).toBeUndefined();
    },
  );
});
