import { expect } from "@playwright/test";

import { joinLink, preJoinUrl } from "./support/campus-entry";
import { membership, sessions, signIn, test } from "./support/fake-api-fixture";

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
  await page.goto(preJoinUrl(CAMPUS));

  await page.getByRole("button", { name: "Turn on camera" }).click();
  await expect(
    page.getByRole("button", { name: "Turn off camera" }),
  ).toHaveAttribute("aria-pressed", "true");

  await joinLink(page).click();

  await expect(page).toHaveURL(CAMPUS);
  await expect(page.getByRole("img", { name: "Campus Map" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Turn off camera" }),
  ).toHaveAttribute("aria-pressed", "true");
});
