import { expect } from "@playwright/test";

import { enterCampus } from "./support/campus-entry";
import { membership, sessions, signIn, test } from "./support/fake-api-fixture";
import { installSanityMapStub } from "./support/sanity-stub";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);

const CAMPUS = "/campus/c-3";
const NOW = Date.now();
const minutesAgo = (minutes: number) =>
  new Date(NOW - minutes * 60_000).toISOString();

// The fake API answers a route the same whatever its query, so the unread
// count (a page of one asking for the unread) reads this list's total.
const LIST = {
  status: 200,
  body: {
    items: [
      {
        id: "n-1",
        kind: "entry_request_admitted",
        referenceType: "entry_request",
        referenceId: "r-1",
        context: { cohortId: "c-3", spaceKey: "library" },
        read: false,
        createdAt: minutesAgo(5),
      },
      {
        id: "n-2",
        kind: "notice_posted",
        referenceType: "notice",
        referenceId: "notice-1",
        context: null,
        read: false,
        createdAt: minutesAgo(90),
      },
    ],
    meta: { page: 1, perPage: 20, total: 2, totalPages: 1 },
  },
} as const;

test.beforeEach(async ({ baseURL, context, fakeApi, page }) => {
  await installSanityMapStub(page);
  await signIn(context, baseURL);
  await fakeApi.scriptSession(sessions.member(membership("c-3", "Cohort 3")));
  await fakeApi.scriptRoutes({
    "GET /v1/notifications": LIST,
    "PATCH /v1/notifications/n-1/read": {
      status: 200,
      body: { ...LIST.body.items[0], read: true },
    },
    "POST /v1/notifications/read-all": { status: 200, body: { marked: 2 } },
  });
});

test("the rail badges unread notifications, and its panel lists them in words", async ({
  page,
}) => {
  await enterCampus(page, CAMPUS);

  const item = page.getByRole("button", { name: "Notifications, 2 unread" });
  await expect(item).toBeVisible();
  await item.click();

  await expect(page.getByText("You were let into library.")).toBeVisible();
  await expect(page.getByText("A new notice was posted.")).toBeVisible();
  await expect(page.getByText("5 minutes ago")).toBeVisible();
  await expect(page.getByText("2 unread")).toBeVisible();
});

test("pressing a notification reads it, and Mark all as read reads the rest", async ({
  fakeApi,
  page,
}) => {
  await enterCampus(page, CAMPUS);
  await page.getByRole("button", { name: "Notifications, 2 unread" }).click();

  await page
    .getByRole("button", { name: "Mark as read: You were let into library." })
    .click();
  await expect
    .poll(
      async () =>
        (await fakeApi.requestsTo("PATCH", "/v1/notifications/n-1/read"))
          .length,
    )
    .toBe(1);

  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect
    .poll(
      async () =>
        (await fakeApi.requestsTo("POST", "/v1/notifications/read-all")).length,
    )
    .toBe(1);
});
