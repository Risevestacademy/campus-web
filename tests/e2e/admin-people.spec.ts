import { expect, type Page } from "@playwright/test";

import { enterCampus, joinButton } from "./support/campus-entry";
import {
  membership,
  type ScriptedReply,
  sessions,
  signIn,
  test,
} from "./support/fake-api-fixture";
import { installSanityMapStub } from "./support/sanity-stub";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);

const PEOPLE = "/campus/c-3/people";
const GRACE_ID = "3f0c2d1a-6b6e-4c4b-8f55-0c9d1e5a7b21";
const COHORT = { id: "c-3", name: "Cohort 3", code: "C3" };

const GRACE = {
  id: GRACE_ID,
  email: "grace@campus.local",
  firstName: "Grace",
  lastName: "Hopper",
  displayName: null,
  avatarUrl: null,
  systemRole: "user",
  status: "active",
  lastLoginAt: null,
  createdAt: "2026-09-22T12:00:00.000Z",
  memberships: [
    {
      cohort: COHORT,
      track: { id: "t-1", name: "Backend", code: "BE" },
      role: "student",
      status: "active",
      joinedAt: "2026-09-22T12:00:00.000Z",
      accessExpiresAt: null,
    },
  ],
};

const USERS: ScriptedReply = {
  status: 200,
  body: {
    items: [GRACE],
    meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
  },
};

const GRACE_CARD: ScriptedReply = {
  status: 200,
  body: {
    id: GRACE_ID,
    email: GRACE.email,
    firstName: "Grace",
    lastName: "Hopper",
    displayName: null,
    bio: null,
    avatarUrl: null,
    spriteKey: null,
    memberships: [
      {
        cohort: COHORT,
        track: { id: "t-1", name: "Backend", code: "BE" },
        role: "student",
      },
    ],
  },
};

const COHORT_DETAIL: ScriptedReply = {
  status: 200,
  body: {
    ...COHORT,
    tracks: [
      {
        id: "ct-1",
        track: { id: "t-1", name: "Backend", code: "BE", description: null },
      },
    ],
  },
};

function searchBox(page: Page) {
  return page.getByRole("searchbox", { name: "Search by name or email" });
}

test.beforeEach(async ({ baseURL, context, fakeApi, page }) => {
  await installSanityMapStub(page);
  await signIn(context, baseURL);
  await fakeApi.scriptSession(sessions.admin(membership("c-3", "Cohort 3")));
  await fakeApi.scriptRoutes({
    "GET /v1/users": USERS,
    [`GET /v1/users/${GRACE_ID}/profile`]: GRACE_CARD,
    "GET /v1/cohorts/c-3": COHORT_DETAIL,
    "GET /v1/cohorts/c-3/profiles": { status: 200, body: [] },
  });
});

test("searching stays in the page: no reload, so the Join admission is kept", async ({
  page,
  fakeApi,
}) => {
  await enterCampus(page, PEOPLE);
  await page.evaluate(() => {
    (window as unknown as { documentMarker: string }).documentMarker = "kept";
  });

  await searchBox(page).fill("grace");
  await page
    .getByRole("search")
    .getByRole("button", { name: "Search" })
    .click();

  await expect(page).toHaveURL(/\/campus\/c-3\/people\?.*q=grace/);
  await expect(joinButton(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  await expect(searchBox(page)).toHaveValue("grace");
  expect(
    await page.evaluate(
      () => (window as unknown as { documentMarker?: string }).documentMarker,
    ),
  ).toBe("kept");

  const reads = await fakeApi.usersReads();
  expect(
    reads.some(
      ({ search }) => new URLSearchParams(search).get("search") === "grace",
    ),
  ).toBe(true);
});

test("pressing Enter in the search box searches the same way", async ({
  page,
}) => {
  await enterCampus(page, PEOPLE);

  await searchBox(page).fill("hopper");
  await searchBox(page).press("Enter");

  await expect(page).toHaveURL(/\/campus\/c-3\/people\?.*q=hopper/);
  await expect(joinButton(page)).toHaveCount(0);
});

test("a click anywhere on a row opens that person", async ({ page }) => {
  await enterCampus(page, PEOPLE);

  await page
    .getByRole("row", { name: /Grace Hopper/ })
    .getByRole("cell")
    .nth(2)
    // The row's link covers the cell, so the click lands on it by position.
    .click({ force: true });

  await expect(page).toHaveURL(`${PEOPLE}/${GRACE_ID}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Grace Hopper" }),
  ).toBeVisible();
  await expect(joinButton(page)).toHaveCount(0);
});

test("a person who is not in this cohort is not shown under it", async ({
  page,
  fakeApi,
}) => {
  await fakeApi.scriptRoutes({
    "GET /v1/users": USERS,
    [`GET /v1/users/${GRACE_ID}/profile`]: {
      status: 200,
      body: {
        ...(GRACE_CARD.body as object),
        memberships: [
          {
            cohort: { id: "c-9", name: "Cohort 9", code: "C9" },
            track: null,
            role: "student",
          },
        ],
      },
    },
    "GET /v1/cohorts/c-3": COHORT_DETAIL,
    "GET /v1/cohorts/c-3/profiles": { status: 200, body: [] },
  });
  await enterCampus(page, PEOPLE);

  await page.getByRole("link", { name: "Grace Hopper" }).click();

  await expect(page.getByText("We can't show this person here.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Attendance history" }),
  ).toHaveCount(0);
});
