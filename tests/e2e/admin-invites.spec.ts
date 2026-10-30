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
