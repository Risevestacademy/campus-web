import { expect } from "@playwright/test";

import { joinButton, preJoinUrl } from "./support/campus-entry";
import { membership, sessions, signIn, test } from "./support/fake-api-fixture";
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
  const captureCount = () =>
    page.evaluate(
      () =>
        (window as unknown as { getUserMediaCalls: number }).getUserMediaCalls,
    );
  await page.goto(preJoinUrl(CAMPUS));
  await page.getByRole("button", { name: "Turn on camera" }).click();
  await expect(
    page.getByRole("button", { name: "Turn off camera" }),
  ).toHaveAttribute("aria-pressed", "true");
  await joinButton(page).click();
  await expect(page).toHaveURL(CAMPUS);
  const capturesAfterJoin = await captureCount();

  await page.getByRole("button", { name: "Administration" }).click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(`${CAMPUS}/overview`);

  const dock = page.getByRole("complementary", { name: "Presence dock" });
  await expect(
    dock.getByRole("button", { name: "Turn off camera" }),
  ).toHaveAttribute("aria-pressed", "true");

  await dock.getByRole("link", { name: "Campus map" }).click();
  await expect(page).toHaveURL(CAMPUS);
  await expect(
    page.getByRole("button", { name: "Turn off camera" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await captureCount()).toBe(capturesAfterJoin);
});
