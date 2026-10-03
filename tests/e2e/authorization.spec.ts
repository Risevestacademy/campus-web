import { type BrowserContext, expect, type Page } from "@playwright/test";

import { enterCampus, joinLink, preJoinUrl } from "./support/campus-entry";
import {
  cohortsPage,
  membership,
  sessions,
  signIn,
  test,
} from "./support/fake-api-fixture";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);

const DESTINATION = "/campus/c-3?tab=people";
const DESTINATION_PRE_JOIN = preJoinUrl(DESTINATION);
const SUCCESS = { status: 200 };
const COHORT_3 = membership("c-3", "Cohort 3");
const COHORT_4 = membership("c-4", "Cohort 4");

function withReturnTo(path: string, returnTo: string, error?: string): string {
  const search = new URLSearchParams({
    ...(error && { error }),
    returnTo,
  });
  return `${path}?${search.toString()}`;
}

function refreshPage(returnTo: string): string {
  return withReturnTo("/session/refresh", returnTo);
}

async function cookieNamed(context: BrowserContext, name: string) {
  return (await context.cookies()).find((cookie) => cookie.name === name);
}

function campusMap(page: Page) {
  return page.getByRole("img", { name: "Campus Map" });
}

function alertWith(page: Page, text: string) {
  return page.getByRole("alert").filter({ hasText: text });
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

test.describe("session refresh", () => {
  test("a successful refresh returns to the exact Campus deep link", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptRefresh(SUCCESS);
    await fakeApi.scriptSession(sessions.member(COHORT_3));
    await page.goto("/");

    await page.goto(refreshPage(DESTINATION));

    await expect(page).toHaveURL(DESTINATION);
    await expect(campusMap(page)).toBeVisible();
    const posts = await fakeApi.refreshPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0]?.cookie).toBe("campus_refresh=refresh-token");

    await page.goBack();
    await expect(page).toHaveURL("/");
  });

  test("a successful refresh marks the visit once and keeps auth cookies scoped", async ({
    page,
    context,
    fakeApi,
  }) => {
    await fakeApi.scriptRefresh(SUCCESS);
    await fakeApi.scriptSession(sessions.member(COHORT_3));
    const refreshed = page.waitForResponse("**/api/v1/auth/refresh");

    await page.goto(refreshPage(DESTINATION));

    const markerSet = (await (await refreshed).headersArray()).find(
      ({ name, value }) =>
        name.toLowerCase() === "set-cookie" &&
        value.startsWith("campus_refresh_attempted="),
    );
    expect(markerSet?.value).toMatch(
      /^campus_refresh_attempted=1; HttpOnly; SameSite=Lax; Path=\/campus; Max-Age=60$/,
    );

    await expect(page).toHaveURL(DESTINATION);
    await expect(campusMap(page)).toBeVisible();
    expect(
      await cookieNamed(context, "campus_refresh_attempted"),
    ).toBeUndefined();
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
      withReturnTo("/sign-in", DESTINATION, "session_expired"),
    );
    await expect(
      alertWith(page, "Your session expired. Please sign in again."),
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
    await fakeApi.scriptSession(sessions.member(COHORT_3));
    await page.clock.install();

    await page.goto(refreshPage(DESTINATION));

    await expect(
      alertWith(page, "We couldn't restore your session"),
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
    await fakeApi.scriptSession(sessions.member(COHORT_3, COHORT_4));

    await page.goto(refreshPage("//attacker.example/campus"));

    await expect(page).toHaveURL("/campus");
  });
});

test.describe("campus route protection", () => {
  test("a visitor without an access cookie enters one refresh before sign-in", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptRefresh({ status: 401 });

    await page.goto(DESTINATION);

    await expect(page).toHaveURL(
      withReturnTo("/sign-in", DESTINATION_PRE_JOIN, "session_expired"),
    );
    expect(await fakeApi.refreshPosts()).toHaveLength(1);
    expect(await fakeApi.sessionReads()).toEqual([]);
  });

  test("a still-valid refresh session survives losing the access cookie", async ({
    page,
    context,
    fakeApi,
  }) => {
    await fakeApi.scriptRefresh(SUCCESS);
    await fakeApi.scriptSession(sessions.member(COHORT_3));

    await page.goto(DESTINATION);

    await expect(page).toHaveURL(DESTINATION_PRE_JOIN);
    await expect(joinLink(page)).toHaveAttribute("href", DESTINATION);
    expect(await fakeApi.refreshPosts()).toHaveLength(1);
    expect(
      await cookieNamed(context, "campus_refresh_attempted"),
    ).toBeUndefined();
  });

  test("a refresh that still leaves no session ends at sign-in without looping", async ({
    page,
    context,
    fakeApi,
  }) => {
    await fakeApi.scriptRefresh(SUCCESS);
    await fakeApi.scriptSession({ status: 401 });

    await page.goto(DESTINATION);

    await expect(page).toHaveURL(
      withReturnTo("/sign-in", DESTINATION_PRE_JOIN),
    );
    expect(await fakeApi.refreshPosts()).toHaveLength(1);
    expect(await fakeApi.sessionReads()).toHaveLength(1);
    expect(
      await cookieNamed(context, "campus_refresh_attempted"),
    ).toBeUndefined();
  });

  test("a provisional session is sent to its invitation", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession(sessions.provisional());

    await page.goto(DESTINATION);

    await expect(page).toHaveURL("/invitation");
  });

  test("a full-access session renders Campus with one session read per navigation", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession(sessions.member(COHORT_3));
    await page.route("**/*", (route) =>
      route.request().headers()["next-router-prefetch"]
        ? route.abort()
        : route.continue(),
    );

    await page.goto(DESTINATION_PRE_JOIN);
    await expect(joinLink(page)).toBeVisible();
    expect(await fakeApi.sessionReads()).toHaveLength(1);

    await joinLink(page).click();

    await expect(campusMap(page)).toBeVisible();
    expect(await fakeApi.sessionReads()).toHaveLength(2);
  });

  test("a session outage renders retry UI instead of a sign-in loop", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession({ status: 503 });

    await page.goto(DESTINATION);

    await expect(
      alertWith(page, "We couldn't check your session"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      DESTINATION_PRE_JOIN,
    );
    await expect(page).toHaveURL(DESTINATION_PRE_JOIN);
    await expect(campusMap(page)).toHaveCount(0);
    expect(await fakeApi.sessionReads()).toHaveLength(3);
    expect(await fakeApi.refreshPosts()).toEqual([]);
  });

  test("a refused account gets the 403 page", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession({ status: 403 });

    const response = await page.goto(DESTINATION);

    expect(response?.status()).toBe(403);
    await expect(
      page.getByRole("heading", { name: "You don't have access to this page" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to Campus" }),
    ).toHaveAttribute("href", "/campus");
  });

  test("a soft navigation checks the session again", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession(sessions.member(COHORT_3, COHORT_4));
    await fakeApi.scriptRefresh({ status: 401 });
    await page.goto("/campus");
    await expect(page.getByRole("link", { name: /Cohort 3/ })).toBeVisible();

    await fakeApi.scriptSession({ status: 401 });
    await page.getByRole("link", { name: /Cohort 3/ }).click();

    await expect(page).toHaveURL(
      withReturnTo("/sign-in", "/campus/c-3/join", "session_expired"),
    );
  });
});

test.describe("campus index", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL);
  });

  test("a member with no cohort gets the 403 page", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.member());

    const response = await page.goto("/campus");

    expect(response?.status()).toBe(403);
  });

  test("a member with one cohort goes straight to its pre-join screen", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.member(COHORT_3));

    await page.goto("/campus");

    await expect(page).toHaveURL("/campus/c-3/join");
    await expect(joinLink(page)).toBeVisible();
  });

  test("a member with several cohorts chooses from their own memberships", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.member(COHORT_3, COHORT_4));

    await page.goto("/campus");

    await expect(page.getByRole("link", { name: /Cohort 3/ })).toHaveAttribute(
      "href",
      "/campus/c-3/join",
    );
    await expect(page.getByRole("link", { name: /Cohort 4/ })).toHaveAttribute(
      "href",
      "/campus/c-4/join",
    );
    expect(await fakeApi.cohortReads()).toEqual([]);
  });

  test("an admin with no cohort place pages through every cohort", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.admin());
    await fakeApi.scriptCohortPages({
      1: cohortsPage(1, 2, ["Alpha", "Beta"]),
      2: cohortsPage(2, 2, ["Gamma"]),
    });

    await page.goto("/campus");
    await expect(page.getByRole("link", { name: /Alpha/ })).toHaveAttribute(
      "href",
      "/campus/alpha/join",
    );

    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL("/campus?page=2");
    await expect(page.getByRole("link", { name: /Gamma/ })).toBeVisible();

    await page.getByRole("link", { name: "Previous page" }).click();
    await expect(page).toHaveURL("/campus?page=1");
    await expect(page.getByRole("link", { name: /Alpha/ })).toBeVisible();
  });

  test("an admin's invalid page number reads the first page", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.admin());
    await fakeApi.scriptCohortPages({ 1: cohortsPage(1, 1, ["Alpha"]) });

    await page.goto("/campus?page=abc");

    await expect(page.getByRole("link", { name: /Alpha/ })).toBeVisible();
    expect(
      (await fakeApi.cohortReads()).map((request) => request.search),
    ).toEqual(["?page=1"]);
  });
});

test.describe("cohort pre-join", () => {
  const MEETING = "/campus/c-3/meeting?tab=people";

  function meetingHeading(page: Page) {
    return page.getByRole("heading", { name: "ActiveCampusMeetingPage" });
  }

  test.beforeEach(async ({ context, baseURL, fakeApi }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession(sessions.member(COHORT_3));
  });

  test("a hard load of an active route stops at pre-join with its deep link", async ({
    page,
  }) => {
    await page.goto(MEETING);

    await expect(page).toHaveURL(preJoinUrl(MEETING));
    await expect(joinLink(page)).toHaveAttribute("href", MEETING);
  });

  test("joining reaches the deep link without another pre-join", async ({
    page,
    fakeApi,
  }) => {
    await page.goto(preJoinUrl(MEETING));
    await expect(joinLink(page)).toBeVisible();
    const readsBeforeJoin = (await fakeApi.sessionReads()).length;

    await joinLink(page).click();

    await expect(page).toHaveURL(MEETING);
    await expect(meetingHeading(page)).toBeVisible();
    expect(await fakeApi.sessionReads()).toHaveLength(readsBeforeJoin + 1);
  });

  test("a reload after entering requires pre-join again", async ({ page }) => {
    await enterCampus(page, MEETING);

    await page.reload();

    await expect(page).toHaveURL(preJoinUrl(MEETING));
  });

  test("router requests inside an entered campus are never sent to pre-join", async ({
    page,
  }) => {
    await enterCampus(page, MEETING);

    const status = await page.evaluate(async () => {
      const response = await fetch("/campus/c-3", {
        headers: { RSC: "1" },
        redirect: "manual",
      });
      return response.status;
    });

    expect(status).toBe(200);
  });

  test("a member gets the 403 page for a cohort they do not belong to", async ({
    page,
  }) => {
    const preJoin = await page.goto("/campus/c-4/join");
    expect(preJoin?.status()).toBe(403);
    await expect(joinLink(page)).toHaveCount(0);

    const active = await page.goto("/campus/c-4/meeting");
    expect(active?.status()).toBe(403);
    await expect(meetingHeading(page)).toHaveCount(0);
  });

  test("an admin with no cohort place enters any cohort", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.admin());

    await enterCampus(page, "/campus/any-cohort");

    await expect(campusMap(page)).toBeVisible();
  });

  for (const returnTo of [
    "/campus/c-4/meeting",
    "/campus/c-3/join",
    "https://attacker.example/campus/c-3",
  ]) {
    test(`pre-join points Join at the cohort's campus instead of ${returnTo}`, async ({
      page,
    }) => {
      const search = new URLSearchParams({ returnTo });

      await page.goto(`/campus/c-3/join?${search.toString()}`);

      await expect(joinLink(page)).toHaveAttribute("href", "/campus/c-3");
    });
  }
});
