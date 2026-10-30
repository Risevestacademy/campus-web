// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parsePeopleList, parsePersonCard } from "./people.schema";
import { parsePeopleQuery } from "./people-query.schema";

const COHORT_ID = "cohort-1";
const META = { page: 2, perPage: 20, total: 41, totalPages: 3 };

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "ada@campus.local",
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: null,
    systemRole: "user",
    status: "active",
    lastLoginAt: null,
    createdAt: "2026-09-22T12:00:00.000Z",
    memberships: [
      {
        cohort: { id: "cohort-2", name: "Other", code: "O" },
        track: null,
        role: "mentor",
      },
      {
        cohort: { id: COHORT_ID, name: "Cohort 1", code: "C1" },
        track: { id: "track-1", name: "Backend", code: "BE" },
        role: "student",
      },
    ],
    ...overrides,
  };
}

describe("people list parser", () => {
  it("reads the role and Track of the membership in this cohort", () => {
    const page = parsePeopleList({ items: [user()], meta: META }, COHORT_ID);

    expect(page).toEqual({
      people: [
        {
          id: "user-1",
          email: "ada@campus.local",
          firstName: "Ada",
          lastName: "Lovelace",
          displayName: null,
          systemRole: "user",
          role: "student",
          trackName: "Backend",
        },
      ],
      page: 2,
      total: 41,
      totalPages: 3,
    });
  });

  it("has no role for someone with no place in this cohort", () => {
    const page = parsePeopleList(
      { items: [user({ memberships: [] })], meta: META },
      COHORT_ID,
    );

    expect(page?.people[0]).toMatchObject({ role: undefined, trackName: null });
  });

  it("rejects a body that is not a page of people", () => {
    expect(
      parsePeopleList({ items: [{ id: "x" }], meta: META }, COHORT_ID),
    ).toBeUndefined();
    expect(parsePeopleList(null, COHORT_ID)).toBeUndefined();
  });
});

describe("person card parser", () => {
  it("reads the fields the person page renders", () => {
    const card = parsePersonCard({
      id: "user-1",
      email: "ada@campus.local",
      firstName: "Ada",
      lastName: "Lovelace",
      displayName: null,
      bio: "Hello",
      avatarUrl: null,
      spriteKey: null,
      memberships: [
        {
          cohort: { id: COHORT_ID, name: "Cohort 1", code: "C1" },
          track: { id: "track-1", name: "Backend", code: "BE" },
          role: "student",
        },
      ],
    });

    expect(card).toEqual({
      id: "user-1",
      email: "ada@campus.local",
      firstName: "Ada",
      lastName: "Lovelace",
      displayName: null,
      memberships: [
        {
          cohort: { id: COHORT_ID, name: "Cohort 1" },
          track: { name: "Backend" },
          role: "student",
        },
      ],
    });
  });
});

describe("people query parser", () => {
  it("reads the role, search, Track and page", () => {
    expect(
      parsePeopleQuery({
        role: "mentor",
        q: "  ada ",
        track: "3f0c2d1a-6b6e-4c4b-8f55-0c9d1e5a7b21",
        page: "3",
      }),
    ).toEqual({
      chip: "mentor",
      search: "ada",
      trackId: "3f0c2d1a-6b6e-4c4b-8f55-0c9d1e5a7b21",
      page: 3,
    });
  });

  it("falls back to everyone on the first page for anything it does not know", () => {
    expect(
      parsePeopleQuery({ role: "admin", q: " ", track: "nope", page: "0" }),
    ).toEqual({
      chip: "all",
      search: undefined,
      trackId: undefined,
      page: 1,
    });
  });
});
