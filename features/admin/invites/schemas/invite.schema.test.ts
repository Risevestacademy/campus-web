// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parseEmailed, parseInvites } from "./invite.schema";
import { parseInvitesQuery } from "./invite-query.schema";

const META = { page: 2, perPage: 20, total: 41, totalPages: 3 };

function invite(overrides: Record<string, unknown> = {}) {
  return {
    id: "invite-1",
    email: "ada@campus.local",
    status: "pending",
    cohortId: "c-1",
    cohortRole: "student",
    systemRole: "user",
    expiresAt: "2026-10-10T12:00:00.000Z",
    invitedBy: "22222222-2222-4222-8222-222222222222",
    revokedBy: null,
    revokedAt: null,
    flaggedAt: null,
    flagMessage: null,
    createdAt: "2026-10-03T12:00:00.000Z",
    ...overrides,
  };
}

describe("invite list parser", () => {
  it("keeps only the fields the page reads", () => {
    expect(parseInvites({ items: [invite()], meta: META })).toEqual({
      invites: [
        {
          id: "invite-1",
          email: "ada@campus.local",
          status: "pending",
          cohortRole: "student",
          expiresAt: "2026-10-10T12:00:00.000Z",
          revokedAt: null,
          createdAt: "2026-10-03T12:00:00.000Z",
        },
      ],
      page: 2,
      total: 41,
      totalPages: 3,
    });
  });

  it("reads an invite with no cohort role", () => {
    expect(
      parseInvites({ items: [invite({ cohortRole: null })], meta: META })
        ?.invites[0]?.cohortRole,
    ).toBeNull();
  });

  it("rejects a status or role the API does not define", () => {
    expect(
      parseInvites({ items: [invite({ status: "lost" })], meta: META }),
    ).toBeUndefined();
    expect(
      parseInvites({ items: [invite({ cohortRole: "dean" })], meta: META }),
    ).toBeUndefined();
    expect(parseInvites(null)).toBeUndefined();
  });
});

describe("resend receipt parser", () => {
  it("reads only whether the email went out", () => {
    expect(
      parseEmailed({ emailStatus: "sent", inviteLink: "https://x?token=s" }),
    ).toBe(true);
    expect(parseEmailed({ emailStatus: "failed" })).toBe(false);
    expect(parseEmailed({ emailStatus: "disabled" })).toBe(false);
    expect(parseEmailed({})).toBeUndefined();
  });
});

describe("invites query parser", () => {
  it("reads a tab and a page", () => {
    expect(parseInvitesQuery({ status: "expired", page: "3" })).toEqual({
      tab: "expired",
      page: 3,
    });
  });

  it("falls back to the first page of pending invites", () => {
    expect(parseInvitesQuery({ status: "declined", page: "x" })).toEqual({
      tab: "pending",
      page: 1,
    });
    expect(parseInvitesQuery({})).toEqual({ tab: "pending", page: 1 });
  });
});
