// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parseRoster } from "./roster.schema";

const META = { page: 1, perPage: 20, total: 1, totalPages: 1 };

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "membership-1",
    role: "student",
    status: "dismissed",
    state: "ended",
    dismissalReason: "Posted the answer to a live assessment.",
    user: {
      id: "user-1",
      email: "ada@campus.local",
      firstName: "Ada",
      lastName: "Lovelace",
      displayName: null,
      avatarUrl: null,
      status: "active",
    },
    track: { id: "t-1", name: "Backend", code: "BE" },
    joinedAt: "2026-09-22T12:00:00.000Z",
    leftAt: "2026-10-13T12:00:00.000Z",
    accessExpiresAt: null,
    ...overrides,
  };
}

describe("roster parser", () => {
  it("keeps only what the Former members list reads", () => {
    expect(parseRoster({ items: [row()], meta: META })).toEqual({
      members: [
        {
          role: "student",
          status: "dismissed",
          dismissalReason: "Posted the answer to a live assessment.",
          leftAt: "2026-10-13T12:00:00.000Z",
          accessExpiresAt: null,
          user: {
            id: "user-1",
            email: "ada@campus.local",
            firstName: "Ada",
            lastName: "Lovelace",
            displayName: null,
            avatarUrl: null,
          },
          track: { name: "Backend" },
        },
      ],
      page: 1,
      total: 1,
      totalPages: 1,
    });
  });

  it("reads a guest whose visit ran out, with no leaving date or track", () => {
    const page = parseRoster({
      items: [
        row({
          role: "guest",
          status: null,
          dismissalReason: null,
          track: null,
          leftAt: null,
          accessExpiresAt: "2026-10-20T12:00:00.000Z",
        }),
      ],
      meta: META,
    });

    expect(page?.members[0]).toMatchObject({
      role: "guest",
      status: null,
      leftAt: null,
      track: null,
    });
  });

  it("rejects a status or role the API does not define, and a body that is not a page", () => {
    expect(
      parseRoster({ items: [row({ status: "expelled" })], meta: META }),
    ).toBeUndefined();
    expect(
      parseRoster({ items: [row({ role: "dean" })], meta: META }),
    ).toBeUndefined();
    expect(parseRoster({ items: "nope", meta: META })).toBeUndefined();
    expect(parseRoster(null)).toBeUndefined();
  });
});
