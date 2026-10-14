import { expect, type Page } from "@playwright/test";

import { joinButton, preJoinUrl } from "./support/campus-entry";
import {
  expiringAt,
  membership,
  sessions,
  signIn,
  test,
} from "./support/fake-api-fixture";
import { installSanityMapStub } from "./support/sanity-stub";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Fake camera devices are a Chromium launch flag.",
);

// Launch options force a new worker, which Playwright only allows at file level.
test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
  permissions: ["camera", "microphone"],
});

const CAMPUS = "/campus/c-3";
const ACCESS_TOKEN_LIFETIME_MS = 10_000;

// Counts camera and microphone captures, so a test can prove the same capture
// stayed live instead of being restarted.
async function countMediaCaptures(page: Page) {
  await page.addInitScript(() => {
    const mediaDevices = navigator.mediaDevices;
    const getUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
    const counter = window as unknown as { getUserMediaCalls: number };
    counter.getUserMediaCalls = 0;
    mediaDevices.getUserMedia = (constraints) => {
      counter.getUserMediaCalls += 1;
      return getUserMedia(constraints);
    };
  });
  return () =>
    page.evaluate(
      () =>
        (window as unknown as { getUserMediaCalls: number }).getUserMediaCalls,
    );
}

async function joinWithCamera(page: Page) {
  await page.goto(preJoinUrl(CAMPUS));
  await page.getByRole("button", { name: "Turn on camera" }).click();
  await expect(
    page.getByRole("button", { name: "Turn off camera" }),
  ).toHaveAttribute("aria-pressed", "true");
  await joinButton(page).click();
  await expect(page).toHaveURL(CAMPUS);
}

async function openAdministrationOverview(page: Page) {
  await page.getByRole("button", { name: "Administration" }).click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(`${CAMPUS}/overview`);
}

function dockCamera(page: Page) {
  return page
    .getByRole("complementary", { name: "Presence dock" })
    .getByRole("button", { name: "Turn off camera" });
}

test("a camera turned on at pre-join is still on inside the campus", async ({
  page,
  context,
  baseURL,
  fakeApi,
}) => {
  await signIn(context, baseURL);
  await fakeApi.scriptSession(sessions.member(membership("c-3", "Cohort 3")));
  await installSanityMapStub(page);
  await page.goto(preJoinUrl(CAMPUS));

  await page.getByRole("button", { name: "Turn on camera" }).click();
  await expect(
    page.getByRole("button", { name: "Turn off camera" }),
  ).toHaveAttribute("aria-pressed", "true");

  await joinButton(page).click();

  await expect(page).toHaveURL(CAMPUS);
  await expect(
    page.getByRole("region", { name: "Campus map" }),
  ).toHaveAttribute("data-status", "ready");
  await expect(
    page.getByRole("button", { name: "Turn off camera" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("a camera turned on at pre-join stays live through Cohort Administration", async ({
  page,
  context,
  baseURL,
  fakeApi,
}) => {
  await signIn(context, baseURL);
  await fakeApi.scriptSession(sessions.admin());
  await installSanityMapStub(page);
  const captureCount = await countMediaCaptures(page);
  await joinWithCamera(page);
  const capturesAfterJoin = await captureCount();

  await openAdministrationOverview(page);

  await expect(dockCamera(page)).toHaveAttribute("aria-pressed", "true");

  await page
    .getByRole("complementary", { name: "Presence dock" })
    .getByRole("link", { name: "Campus map" })
    .click();
  await expect(page).toHaveURL(CAMPUS);
  await expect(
    page.getByRole("button", { name: "Turn off camera" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await captureCount()).toBe(capturesAfterJoin);
});

test("Session Renewal keeps the camera live past the access token's lifetime", async ({
  page,
  context,
  baseURL,
  fakeApi,
}) => {
  const expiresAt = Date.now() + ACCESS_TOKEN_LIFETIME_MS;
  await signIn(context, baseURL, { expiresAt });
  await fakeApi.scriptSession(expiringAt(sessions.admin(), expiresAt));
  await fakeApi.scriptRefresh({ status: 200 });
  await installSanityMapStub(page);
  const captureCount = await countMediaCaptures(page);
  const refreshPageRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/session/refresh") {
      refreshPageRequests.push(request.url());
    }
  });
  const renewal = page.waitForResponse("**/api/v1/auth/refresh");

  await joinWithCamera(page);
  const capturesAfterJoin = await captureCount();

  expect((await renewal).ok()).toBe(true);
  const accessCookie = (await context.cookies()).find(
    (cookie) => cookie.name === "campus_session",
  );
  expect(accessCookie?.value).toBe("rotated-session");

  // Unrenewed, the browser has dropped the access cookie by now.
  await expect
    .poll(() => Date.now(), { timeout: ACCESS_TOKEN_LIFETIME_MS })
    .toBeGreaterThan(expiresAt);
  await openAdministrationOverview(page);

  await expect(dockCamera(page)).toHaveAttribute("aria-pressed", "true");
  expect(await captureCount()).toBe(capturesAfterJoin);
  expect(await fakeApi.refreshPosts()).toHaveLength(1);
  expect(refreshPageRequests).toEqual([]);

  await page.reload();
  await expect(page).toHaveURL(preJoinUrl(`${CAMPUS}/overview`));
  await expect(joinButton(page)).toBeVisible();
});
