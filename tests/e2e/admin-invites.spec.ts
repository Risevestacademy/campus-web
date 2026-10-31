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

const INVITES = "/campus/c-3/invites";
const INVITE_ID = "44444444-4444-4444-8444-444444444444";

const INVITES_PAGE: ScriptedReply = {
  status: 200,
  body: {
    items: [
      {
        id: INVITE_ID,
        email: "ada@campus.local",
        status: "pending",
        cohortId: "c-3",
        cohortRole: "student",
        systemRole: "user",
        expiresAt: new Date(Date.now() + 36 * 3_600_000).toISOString(),
        invitedBy: "22222222-2222-4222-8222-222222222222",
        revokedBy: null,
        revokedAt: null,
        flaggedAt: null,
        flagMessage: null,
        createdAt: "2026-10-03T12:00:00.000Z",
      },
    ],
    meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
  },
};

function row(page: Page) {
  return page.getByRole("row", { name: /ada@campus.local/ });
}

test.beforeEach(async ({ baseURL, context, fakeApi, page }) => {
  await installSanityMapStub(page);
  await signIn(context, baseURL);
  await fakeApi.scriptSession(sessions.admin(membership("c-3", "Cohort 3")));
  await fakeApi.scriptRoutes({
    "GET /v1/invites": INVITES_PAGE,
    [`POST /v1/invites/${INVITE_ID}/resend`]: {
      status: 200,
      body: { emailStatus: "sent" },
    },
    [`POST /v1/invites/${INVITE_ID}/revoke`]: {
      status: 200,
      body: { status: "revoked" },
    },
    "GET /v1/cohorts/c-3/profiles": { status: 200, body: [] },
    "GET /v1/cohorts/c-3": {
      status: 200,
      body: {
        id: "c-3",
        name: "Cohort 3",
        code: "C3",
        tracks: [
          {
            id: "ct-1",
            track: {
              id: "t-1",
              name: "Backend",
              code: "BE",
              description: null,
            },
          },
        ],
      },
    },
    "GET /v1/cohorts/c-3/mentorship-groups": {
      status: 200,
      body: {
        items: [],
        meta: { page: 1, perPage: 100, total: 0, totalPages: 0 },
      },
    },
    "POST /v1/invites": { status: 201, body: { emailStatus: "sent" } },
    "POST /v1/invites/import": {
      status: 200,
      body: {
        total: 2,
        invited: 2,
        failed: 0,
        rows: [
          {
            line: 2,
            email: "ada@campus.local",
            outcome: "invited",
            emailStatus: "sent",
          },
          {
            line: 3,
            email: "grace@campus.local",
            outcome: "invited",
            emailStatus: "sent",
          },
        ],
      },
    },
  });
});

test("changing tabs stays in the page and asks for that status", async ({
  page,
  fakeApi,
}) => {
  await enterCampus(page, INVITES);
  await page.evaluate(() => {
    (window as unknown as { documentMarker: string }).documentMarker = "kept";
  });

  await page.getByRole("link", { name: /^Expired/ }).click();

  await expect(page).toHaveURL(`${INVITES}?status=expired`);
  await expect(joinButton(page)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { documentMarker?: string }).documentMarker,
    ),
  ).toBe("kept");
  const reads = await fakeApi.requestsTo("GET", "/v1/invites");
  expect(
    reads.some(
      ({ search }) => new URLSearchParams(search).get("status") === "expired",
    ),
  ).toBe(true);
});

test("Resend asks the API to resend that invite and says so", async ({
  page,
  fakeApi,
}) => {
  await enterCampus(page, INVITES);

  await row(page)
    .getByRole("button", { name: /^Resend invite/ })
    .click();

  await expect(page.getByText("Invite resent")).toBeVisible();
  const posts = await fakeApi.requestsTo(
    "POST",
    `/v1/invites/${INVITE_ID}/resend`,
  );
  expect(posts).toHaveLength(1);
});

test("Revoke asks the API to revoke that invite and says so", async ({
  page,
  fakeApi,
}) => {
  await enterCampus(page, INVITES);

  await row(page)
    .getByRole("button", { name: /^Revoke invite/ })
    .click();

  await expect(page.getByText("Invite revoked")).toBeVisible();
  const posts = await fakeApi.requestsTo(
    "POST",
    `/v1/invites/${INVITE_ID}/revoke`,
  );
  expect(posts).toHaveLength(1);
});

test("Invite people sends one invite per address with the chosen placement", async ({
  page,
  fakeApi,
}) => {
  await enterCampus(page, INVITES);

  await page.getByRole("button", { name: "Invite people" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Emails" })
    .fill("ada@campus.local, grace@campus.local, ");
  await dialog.getByRole("combobox", { name: /^Track/ }).selectOption("ct-1");
  await dialog.getByRole("button", { name: "Send 2 invites" }).click();

  await expect(page.getByText("2 invites sent")).toBeVisible();
  const posts = await fakeApi.requestsTo("POST", "/v1/invites");
  expect(posts.map(({ body }) => JSON.parse(body))).toEqual([
    {
      email: "ada@campus.local",
      cohortId: "c-3",
      cohortRole: "student",
      cohortTrackId: "ct-1",
    },
    {
      email: "grace@campus.local",
      cohortId: "c-3",
      cohortRole: "student",
      cohortTrackId: "ct-1",
    },
  ]);
});

test("Invite people shows only the fields a role takes", async ({ page }) => {
  await enterCampus(page, INVITES);

  await page.getByRole("button", { name: "Invite people" }).click();
  const dialog = page.getByRole("dialog");
  const role = dialog.getByRole("combobox", { name: /^Role/ });
  const track = dialog.getByRole("combobox", { name: /^Track/ });
  const group = dialog.getByRole("combobox", { name: /^Mentorship group/ });

  await expect(track).toBeVisible();
  await expect(group).toBeVisible();
  await role.selectOption("professor");
  await expect(track).toBeVisible();
  await expect(group).toHaveCount(0);
  await role.selectOption("mentor");
  await expect(track).toHaveCount(0);
  await expect(group).toHaveCount(0);
  await role.selectOption("admin");
  await expect(track).toHaveCount(0);
  await expect(group).toHaveCount(0);
});

test("Bulk invite uploads the file and the cohort as a multipart form", async ({
  page,
  fakeApi,
}) => {
  await enterCampus(page, INVITES);

  await page.getByRole("button", { name: "Bulk invite" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Choose a CSV file/).setInputFiles({
    name: "cohort3.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "email,role,track\nada@campus.local,student,BE\ngrace@campus.local,professor,\n",
    ),
  });
  await expect(dialog.getByText("cohort3.csv · 2 rows")).toBeVisible();
  await dialog.getByRole("button", { name: "Send 2 invites" }).click();

  await expect(page.getByText("2 invites sent")).toBeVisible();
  const [upload, ...others] = await fakeApi.requestsTo(
    "POST",
    "/v1/invites/import",
  );
  expect(others).toEqual([]);
  expect(upload?.body).toContain('name="cohortId"');
  expect(upload?.body).toContain("c-3");
  expect(upload?.body).toContain('filename="cohort3.csv"');
  expect(upload?.body).toContain("grace@campus.local,professor,");
});
