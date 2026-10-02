import { type BrowserContext, expect } from "@playwright/test";

import { test } from "./support/fake-api-fixture";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);

const DESTINATION = "/campus/42?tab=people";
const SUCCESS = { status: 200 };

function refreshPage(returnTo: string): string {
  return `/session/refresh?${new URLSearchParams({ returnTo }).toString()}`;
}

async function cookieNamed(context: BrowserContext, name: string) {
  return (await context.cookies()).find((cookie) => cookie.name === name);
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([
    {
      name: "campus_refresh",
      value: "refresh-token",
      domain: new URL(baseURL ?? "http://127.0.0.1").hostname,
      path: "/api/v1/auth",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
});

test("a successful refresh returns to the exact Campus deep link", async ({
  page,
  fakeApi,
}) => {
  await fakeApi.scriptRefresh(SUCCESS);
  await page.goto("/");

  await page.goto(refreshPage(DESTINATION));

  await expect(page).toHaveURL(DESTINATION);
  const posts = await fakeApi.refreshPosts();
  expect(posts).toHaveLength(1);
  expect(posts[0]?.cookie).toBe("campus_refresh=refresh-token");

  await page.goBack();
  await expect(page).toHaveURL("/");
});

test("a successful refresh marks the visit and keeps auth cookies scoped", async ({
  page,
  context,
  fakeApi,
}) => {
  await fakeApi.scriptRefresh(SUCCESS);

  await page.goto(refreshPage(DESTINATION));
  await expect(page).toHaveURL(DESTINATION);

  const marker = await cookieNamed(context, "campus_refresh_attempted");
  expect(marker).toMatchObject({
    value: "1",
    path: "/campus",
    httpOnly: true,
    sameSite: "Lax",
  });
  const secondsLeft = (marker?.expires ?? 0) - Date.now() / 1000;
  expect(secondsLeft).toBeGreaterThan(0);
  expect(secondsLeft).toBeLessThanOrEqual(60);

  expect(await cookieNamed(context, "campus_session")).toMatchObject({
    value: "rotated-session",
    path: "/",
    httpOnly: true,
  });
  expect(await cookieNamed(context, "campus_refresh")).toMatchObject({
    value: "rotated-refresh",
    path: "/api/v1/auth",
    httpOnly: true,
  });
});

test("a rejected refresh sends the visitor to sign-in with their destination", async ({
  page,
  context,
  fakeApi,
}) => {
  await fakeApi.scriptRefresh({ status: 401 });

  await page.goto(refreshPage(DESTINATION));

  await expect(page).toHaveURL(
    `/sign-in?${new URLSearchParams({ error: "session_expired", returnTo: DESTINATION }).toString()}`,
  );
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Your session expired. Please sign in again." }),
  ).toBeVisible();
  expect(
    await cookieNamed(context, "campus_refresh_attempted"),
  ).toBeUndefined();
});

test("an outage fails closed and only retries when asked", async ({
  page,
  fakeApi,
}) => {
  await fakeApi.scriptRefresh({ status: 503 }, SUCCESS);
  await page.clock.install();

  await page.goto(refreshPage(DESTINATION));

  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "We couldn't restore your session" }),
  ).toBeVisible();
  const retry = page.getByRole("button", { name: "Try again" });
  await expect(retry).toBeDisabled();

  await page.clock.fastForward(60_000);

  await expect(retry).toBeEnabled();
  expect(await fakeApi.refreshPosts()).toHaveLength(1);

  await retry.click();

  await expect(page).toHaveURL(DESTINATION);
  expect(await fakeApi.refreshPosts()).toHaveLength(2);
});

test("an off-site destination is replaced with the campus index", async ({
  page,
  fakeApi,
}) => {
  await fakeApi.scriptRefresh(SUCCESS);

  await page.goto(refreshPage("//attacker.example/campus"));

  await expect(page).toHaveURL("/campus");
});
