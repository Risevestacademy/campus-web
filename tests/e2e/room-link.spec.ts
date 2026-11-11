import { expect } from "@playwright/test";

import { joinButton } from "./support/campus-entry";
import { membership, sessions, signIn, test } from "./support/fake-api-fixture";
import { installSanityMapStub } from "./support/sanity-stub";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);

const CODE = "k3F9xQ2pLm";
const ENTER = `POST /v1/room-links/${CODE}/enter`;

test.beforeEach(async ({ page }) => {
  await installSanityMapStub(page);
});

test("a member following a link joins its cohort and arrives on the map asking for the space", async ({
  baseURL,
  context,
  fakeApi,
  page,
}) => {
  await signIn(context, baseURL);
  await fakeApi.scriptSession(
    sessions.invitedMember(membership("c-1", "Cohort 1")),
  );
  await fakeApi.scriptRoutes({
    [ENTER]: {
      status: 200,
      body: {
        code: CODE,
        title: "Design review",
        cohortId: "c-1",
        spaceId: "s-1",
        spaceKey: "library",
        spaceName: "Library",
        startsAt: null,
        endsAt: null,
        admitted: true,
      },
    },
  });

  await page.goto(`/join/${CODE}`);

  await expect(page).toHaveURL(
    `/campus/c-1/join?returnTo=${encodeURIComponent("/campus/c-1?goToSpace=library")}`,
  );
  await joinButton(page).click();
  await expect(page).toHaveURL(/^[^?]*\/campus\/c-1(\?goToSpace=library)?$/);
});

test("a link that does not work says so and offers the campus", async ({
  baseURL,
  context,
  fakeApi,
  page,
}) => {
  await signIn(context, baseURL);
  await fakeApi.scriptSession(
    sessions.invitedMember(membership("c-1", "Cohort 1")),
  );
  await fakeApi.scriptRoutes({
    [ENTER]: {
      status: 404,
      body: { error: { code: "NOT_FOUND", message: "Not found" } },
    },
  });

  await page.goto(`/join/${CODE}`);

  await expect(
    page.getByRole("heading", { name: "This link doesn't work" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Campus" })).toBeVisible();
});

test("a visitor who is signed out is sent to restore a session, then back to the link", async ({
  page,
}) => {
  await page.goto(`/join/${CODE}`);

  await expect(page).toHaveURL(
    new RegExp(
      `/session/refresh\\?returnTo=${encodeURIComponent(`/join/${CODE}`)}$`,
    ),
  );
});

test("a code of the wrong shape is a 404 without asking campus-api", async ({
  baseURL,
  context,
  fakeApi,
  page,
}) => {
  await signIn(context, baseURL);
  await fakeApi.scriptSession(
    sessions.invitedMember(membership("c-1", "Cohort 1")),
  );

  const response = await page.goto("/join/short");

  expect(response?.status()).toBe(404);
  expect(
    await fakeApi.requestsTo("POST", `/v1/room-links/short/enter`),
  ).toEqual([]);
});
