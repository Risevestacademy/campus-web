import { type BrowserContext, expect, type Page } from "@playwright/test";

import {
  enterCampus,
  joinButton,
  JOINED_ELSEWHERE,
  moveHereButton,
  openSecondTab,
  preJoinUrl,
  presenceTabChoice,
  TAKEN_OVER,
} from "./support/campus-entry";
import {
  cohortsPage,
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
  return page.getByRole("region", { name: "Campus map" });
}

function alertWith(page: Page, text: string) {
  return page.getByRole("alert").filter({ hasText: text });
}

function googleLink(page: Page) {
  return page.getByRole("link", { name: "Continue with Google" });
}

// Scoped to <main>: Next's route announcer is a live region outside it.
function signInError(page: Page) {
  return page.getByRole("main").getByRole("alert");
}

function invitationHeading(page: Page) {
  return page.getByRole("heading", { name: /invited to join/ });
}

function previewHeading(page: Page) {
  return page.getByRole("heading", { name: "Are your details correct?" });
}

async function skipPrefetches(page: Page) {
  await page.route("**/*", (route) =>
    route.request().headers()["next-router-prefetch"]
      ? route.abort()
      : route.fallback(),
  );
}

test.beforeEach(async ({ context, baseURL, page }) => {
  await installSanityMapStub(page);
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
  test("a successful refresh sends the exact Campus deep link through pre-join", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptRefresh(SUCCESS);
    await fakeApi.scriptSession(sessions.member(COHORT_3));
    await page.goto("/");

    await page.goto(refreshPage(DESTINATION));

    await expect(page).toHaveURL(DESTINATION_PRE_JOIN);
    await expect(joinButton(page)).toBeVisible();
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
      /^campus_refresh_attempted=1; HttpOnly; SameSite=Lax; Path=\/; Max-Age=60$/,
    );

    await expect(page).toHaveURL(DESTINATION_PRE_JOIN);
    await expect(joinButton(page)).toBeVisible();
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

  test("a rejected refresh sends the visitor to plain sign-in with their destination", async ({
    page,
    context,
    fakeApi,
  }) => {
    await fakeApi.scriptRefresh({ status: 401 });

    await page.goto(refreshPage(DESTINATION));

    await expect(page).toHaveURL(withReturnTo("/sign-in", DESTINATION));
    await expect(googleLink(page)).toBeVisible();
    await expect(signInError(page)).toHaveCount(0);
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

    await expect(page).toHaveURL(DESTINATION_PRE_JOIN);
    await expect(joinButton(page)).toBeVisible();
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

    await expect(page).toHaveURL(withReturnTo("/sign-in", DESTINATION));
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
    await expect(joinButton(page)).toBeVisible();
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

    await expect(page).toHaveURL(withReturnTo("/sign-in", DESTINATION));
    expect(await fakeApi.refreshPosts()).toHaveLength(1);
    // One read by the protected route, one by sign-in, which then renders.
    expect(await fakeApi.sessionReads()).toHaveLength(2);
    expect(
      await cookieNamed(context, "campus_refresh_attempted"),
    ).toBeUndefined();
  });

  test("a provisional session is sent to answer its invitation", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession(sessions.provisional());

    await page.goto(DESTINATION);

    await expect(page).toHaveURL("/preview");
    await expect(previewHeading(page)).toBeVisible();
  });

  test("a full-access session renders Campus with one session read per navigation", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession(sessions.member(COHORT_3));
    await skipPrefetches(page);

    await page.goto(DESTINATION_PRE_JOIN);
    await expect(joinButton(page)).toBeVisible();
    expect(await fakeApi.sessionReads()).toHaveLength(1);

    await joinButton(page).click();

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
      DESTINATION,
    );
    await expect(page).toHaveURL(DESTINATION);
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

    await expect(page).toHaveURL(withReturnTo("/sign-in", "/campus/c-3/join"));
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
    context,
    baseURL,
    fakeApi,
  }) => {
    await context.addCookies([
      {
        name: "campus_entry_c-3",
        value: "1",
        domain: new URL(baseURL ?? "http://127.0.0.1").hostname,
        path: "/campus",
        sameSite: "Lax",
      },
    ]);
    await fakeApi.scriptSession(sessions.member(COHORT_3));

    await page.goto("/campus");

    await expect(page).toHaveURL("/campus/c-3/join");
    await expect(joinButton(page)).toBeVisible();
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
    await expect(page).toHaveURL("/campus?view=cohorts&page=2");
    await expect(page.getByRole("link", { name: /Gamma/ })).toBeVisible();

    await page.getByRole("link", { name: "Previous page" }).click();
    await expect(page).toHaveURL("/campus?view=cohorts&page=1");
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

  test("a hard load of an active route redirects through pre-join", async ({
    page,
  }) => {
    await page.goto(MEETING);

    await expect(page).toHaveURL(preJoinUrl(MEETING));
    await expect(joinButton(page)).toBeVisible();
    await expect(meetingHeading(page)).toHaveCount(0);
  });

  test("joining reaches the prepared deep link without recording entry state", async ({
    page,
    context,
    fakeApi,
  }) => {
    await page.goto(preJoinUrl(MEETING));
    await expect(joinButton(page)).toBeVisible();
    const readsBeforeJoin = (await fakeApi.sessionReads()).length;

    await joinButton(page).click();

    await expect(page).toHaveURL(MEETING);
    await expect(meetingHeading(page)).toBeVisible();
    expect(await fakeApi.sessionReads()).toHaveLength(readsBeforeJoin + 1);
    expect(await cookieNamed(context, "campus_entry_c-3")).toBeUndefined();
  });

  test("a reload after entering returns through pre-join", async ({ page }) => {
    await enterCampus(page, MEETING);

    await page.reload();

    await expect(page).toHaveURL(preJoinUrl(MEETING));
    await expect(joinButton(page)).toBeVisible();
  });

  test("stays joined while moving between the map and Administration", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.admin());
    await enterCampus(page, "/campus/c-3");

    await page.getByRole("button", { name: "Administration" }).click();
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await expect(page).toHaveURL("/campus/c-3/overview");
    await page.getByRole("link", { name: "Campus overview" }).click();

    await expect(page).toHaveURL("/campus/c-3");
    await expect(campusMap(page)).toBeVisible();
    await expect(joinButton(page)).toHaveCount(0);
  });

  test("a hard load of an administration page redirects through pre-join", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.admin());

    await page.goto("/campus/c-3/overview");

    await expect(page).toHaveURL(preJoinUrl("/campus/c-3/overview"));
    await expect(joinButton(page)).toBeVisible();
  });

  test("a reload on Administration returns through pre-join to the same page", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.admin());
    await enterCampus(page, "/campus/c-3/overview");

    await page.reload();
    await expect(page).toHaveURL(preJoinUrl("/campus/c-3/overview"));
    await joinButton(page).click();

    await expect(page).toHaveURL("/campus/c-3/overview");
    await expect(
      page.getByRole("complementary", { name: "Presence dock" }),
    ).toBeVisible();
  });

  test("a navigation after the access cookie lapses restores through refresh and pre-join", async ({
    page,
    context,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.admin());
    await enterCampus(page, "/campus/c-3/overview");

    await context.clearCookies({ name: "campus_session" });
    await fakeApi.scriptRefresh(SUCCESS);
    const refreshed = page.waitForResponse("**/api/v1/auth/refresh");
    await page.getByRole("link", { name: "Campus overview" }).click();
    expect((await refreshed).ok()).toBe(true);

    await expect(page).toHaveURL(preJoinUrl("/campus/c-3"));
    await expect(joinButton(page)).toBeVisible();
  });

  test("an ended session keeps the Presence Session and offers sign-in", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(
      expiringAt(sessions.admin(), Date.now() + 8_000),
    );
    await fakeApi.scriptRefresh({ status: 401 });

    await enterCampus(page, "/campus/c-3/overview");

    await expect(
      page.getByRole("heading", { name: "Your session ended" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page).toHaveURL("/campus/c-3/overview");
    await expect(
      page.getByRole("complementary", { name: "Presence dock" }),
    ).toBeVisible();
    expect(await fakeApi.refreshPosts()).toHaveLength(1);
  });

  test("an explicit pre-join visit remains available after an active visit", async ({
    page,
  }) => {
    await enterCampus(page, MEETING);

    await page.goto(preJoinUrl(MEETING));

    await expect(page).toHaveURL(preJoinUrl(MEETING));
    await expect(joinButton(page)).toBeVisible();
  });

  test("a member gets the 403 page for a cohort they do not belong to", async ({
    page,
  }) => {
    const preJoin = await page.goto("/campus/c-4/join");
    expect(preJoin?.status()).toBe(403);
    await expect(joinButton(page)).toHaveCount(0);

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
    test(`pre-join sends Join to the cohort's campus instead of ${returnTo}`, async ({
      page,
    }) => {
      const search = new URLSearchParams({ returnTo });

      await page.goto(`/campus/c-3/join?${search.toString()}`);

      await joinButton(page).click();

      await expect(page).toHaveURL("/campus/c-3");
    });
  }

  test("a copied completion marker still redirects through pre-join", async ({
    page,
  }) => {
    await page.goto(`${MEETING}&prejoin=complete`);

    await expect(page).toHaveURL(preJoinUrl(MEETING));
    await expect(joinButton(page)).toBeVisible();
  });

  test("a second tab on the same cohort offers to move the session", async ({
    page,
    context,
  }) => {
    await enterCampus(page, MEETING);
    const secondPage = await openSecondTab(context);

    try {
      await secondPage.goto(MEETING);

      await expect(secondPage).toHaveURL(preJoinUrl(MEETING));
      await expect(
        presenceTabChoice(secondPage, JOINED_ELSEWHERE),
      ).toBeVisible();
      await expect(joinButton(secondPage)).toHaveCount(0);

      await moveHereButton(secondPage).click();

      await expect(secondPage).toHaveURL(MEETING);
      await expect(meetingHeading(secondPage)).toBeVisible();
      await expect(presenceTabChoice(page, TAKEN_OVER)).toBeVisible();
      await expect(meetingHeading(page)).toHaveCount(0);
    } finally {
      await secondPage.close();
    }
  });

  test("a taken-over tab takes the session back in place", async ({
    page,
    context,
  }) => {
    await enterCampus(page, MEETING);
    const secondPage = await openSecondTab(context);

    try {
      await secondPage.goto(preJoinUrl(MEETING));
      await moveHereButton(secondPage).click();
      await expect(meetingHeading(secondPage)).toBeVisible();

      await moveHereButton(page).click();

      await expect(page).toHaveURL(MEETING);
      await expect(meetingHeading(page)).toBeVisible();
      await expect(presenceTabChoice(secondPage, TAKEN_OVER)).toBeVisible();
      await expect(meetingHeading(secondPage)).toHaveCount(0);
    } finally {
      await secondPage.close();
    }
  });

  test("a second cohort in another tab joins normally", async ({
    page,
    context,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.member(COHORT_3, COHORT_4));
    await enterCampus(page, "/campus/c-3");
    const secondPage = await openSecondTab(context);

    try {
      await enterCampus(secondPage, "/campus/c-4");

      await expect(campusMap(secondPage)).toBeVisible();
      await expect(campusMap(page)).toBeVisible();
      await expect(presenceTabChoice(page, TAKEN_OVER)).toHaveCount(0);
    } finally {
      await secondPage.close();
    }
  });

  test("leaving the joined tab lets the other tab join", async ({
    page,
    context,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.member(COHORT_3, COHORT_4));
    await enterCampus(page, MEETING);
    const secondPage = await openSecondTab(context);

    try {
      await secondPage.goto(preJoinUrl(MEETING));
      await expect(
        presenceTabChoice(secondPage, JOINED_ELSEWHERE),
      ).toBeVisible();

      await page.getByRole("link", { name: "Back to campuses" }).click();
      await expect(page).toHaveURL("/campus");
      await expect(page.getByRole("link", { name: /Cohort 3/ })).toBeVisible();

      await expect(joinButton(secondPage)).toBeVisible();
      await expect(presenceTabChoice(secondPage, JOINED_ELSEWHERE)).toHaveCount(
        0,
      );
    } finally {
      await secondPage.close();
    }
  });

  test("closing the joined tab lets the other tab join once the member returns to it", async ({
    page,
    context,
  }) => {
    await enterCampus(page, MEETING);
    const secondPage = await openSecondTab(context);

    try {
      await secondPage.goto(preJoinUrl(MEETING));
      await expect(
        presenceTabChoice(secondPage, JOINED_ELSEWHERE),
      ).toBeVisible();

      await page.close();

      // A closed tab sends no notice, and headless browsers never focus a
      // page, so this stands in for the member switching back to the tab.
      await expect(async () => {
        await secondPage.evaluate(() =>
          window.dispatchEvent(new Event("focus")),
        );
        await expect(joinButton(secondPage)).toBeVisible({ timeout: 2_000 });
      }).toPass();
    } finally {
      await secondPage.close();
    }
  });

  test("switching cohorts starts at the next cohort's Join Gate", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.member(COHORT_3, COHORT_4));
    await enterCampus(page, "/campus/c-3");

    await page.getByRole("link", { name: "Back to campuses" }).click();
    await page.getByRole("link", { name: /Cohort 4/ }).click();

    await expect(page).toHaveURL("/campus/c-4/join");
    await expect(joinButton(page)).toBeVisible();
  });
});

test.describe("sign-in", () => {
  test("an anonymous visitor sees sign-in without a session read", async ({
    page,
    fakeApi,
  }) => {
    await page.goto(withReturnTo("/sign-in", "/invitation"));

    await expect(googleLink(page)).toHaveAttribute(
      "href",
      "/api/v1/auth/google?returnTo=%2Finvitation",
    );
    expect(await fakeApi.sessionReads()).toEqual([]);
  });

  test("a provisional session with an invite is sent to answer it", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession(sessions.provisional());

    await page.goto(withReturnTo("/sign-in", "/preview"));

    await expect(page).toHaveURL("/preview");
    await expect(previewHeading(page)).toBeVisible();
  });

  test("a full-access session leaves for its safe destination", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession(sessions.member(COHORT_3));

    await page.goto(withReturnTo("/sign-in", "/campus/c-3/join"));

    await expect(page).toHaveURL("/campus/c-3/join");
    await expect(joinButton(page)).toBeVisible();
  });

  test("an off-site destination sends a full-access session to Campus", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession(sessions.member(COHORT_3));

    await page.goto(withReturnTo("/sign-in", "//attacker.example/campus"));

    await expect(page).toHaveURL("/campus/c-3/join");
  });

  test("a session outage renders sign-in instead of redirecting", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession({ status: 503 });

    await page.goto("/sign-in");

    await expect(page).toHaveURL("/sign-in");
    await expect(googleLink(page)).toBeVisible();
    expect(await fakeApi.refreshPosts()).toEqual([]);
  });
});

test.describe("invitation routes", () => {
  test("a provisional session without an invite stops at sign-in with the reason", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession(sessions.provisional(null));

    await page.goto("/invitation");

    await expect(page).toHaveURL("/sign-in?error=invite_required");
    await expect(
      alertWith(page, "You need an invitation to access Campus."),
    ).toBeVisible();
    expect(await fakeApi.sessionReads()).toHaveLength(2);
  });

  for (const path of ["/invitation", "/preview"]) {
    test(`a full-access session without an invite is sent from ${path} to Campus`, async ({
      page,
      context,
      baseURL,
      fakeApi,
    }) => {
      await signIn(context, baseURL);
      await fakeApi.scriptSession(sessions.member(COHORT_3));

      await page.goto(path);

      await expect(page).toHaveURL("/campus/c-3/join");
    });
  }

  test("an invited member landing on the invitation without a token is sent to the preview", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession(sessions.invitedMember(COHORT_3));

    await page.goto("/invitation");

    await expect(page).toHaveURL("/preview");
    await expect(previewHeading(page)).toBeVisible();
  });

  test("an expired invitation session that refreshes goes on to answer the invite", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptRefresh(SUCCESS);
    await fakeApi.scriptSession(sessions.provisional());

    await page.goto("/invitation");

    await expect(page).toHaveURL("/preview");
    await expect(previewHeading(page)).toBeVisible();
    expect(await fakeApi.refreshPosts()).toHaveLength(1);
  });

  test("an invitation session still signed out after a refresh ends at sign-in without looping", async ({
    page,
    context,
    fakeApi,
  }) => {
    await fakeApi.scriptRefresh(SUCCESS);
    await fakeApi.scriptSession({ status: 401 });

    await page.goto("/invitation");

    await expect(page).toHaveURL(withReturnTo("/sign-in", "/invitation"));
    expect(await fakeApi.refreshPosts()).toHaveLength(1);
    // One read by the protected route, one by sign-in, which then renders.
    expect(await fakeApi.sessionReads()).toHaveLength(2);
    // No proxy runs here to clear it; the marker ages out after 60 s.
    expect(
      await cookieNamed(context, "campus_refresh_attempted"),
    ).toMatchObject({ path: "/" });
  });

  test("an invitation session whose refresh is rejected goes to plain sign-in", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptRefresh({ status: 401 });

    await page.goto("/preview");

    await expect(page).toHaveURL(withReturnTo("/sign-in", "/preview"));
    await expect(signInError(page)).toHaveCount(0);
  });

  test("a refused account gets the 403 page", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession({ status: 403 });

    const response = await page.goto("/invitation");

    expect(response?.status()).toBe(403);
  });

  test("a session outage renders retry UI inside the auth layout", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession({ status: 503 });

    await page.goto("/invitation");

    await expect(
      alertWith(page, "We couldn't check your session"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/invitation",
    );
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(invitationHeading(page)).toHaveCount(0);
  });
});

test.describe("log out", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL);
  });

  function logOutFromAccountMenu(page: Page) {
    return test.step("log out from the account menu", async () => {
      await page.getByRole("button", { name: "Account" }).click();
      await page.getByRole("menuitem", { name: "Log out" }).click();
    });
  }

  test("a single-cohort member logs out from the rail and both auth cookies go", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.member(COHORT_3));
    await enterCampus(page, "/campus/c-3");
    const historyLength = await page.evaluate(() => history.length);

    await logOutFromAccountMenu(page);

    await expect(page).toHaveURL("/sign-in");
    await expect(googleLink(page)).toBeVisible();
    const posts = await fakeApi.logoutPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0]?.cookie).toContain("campus_refresh=refresh-token");
    expect(await cookieNamed(context, "campus_session")).toBeUndefined();
    expect(await cookieNamed(context, "campus_refresh")).toBeUndefined();
    expect(await page.evaluate(() => history.length)).toBe(historyLength);

    await signIn(context, baseURL);
    await page.goto("/campus/c-3");

    await expect(page).toHaveURL(preJoinUrl("/campus/c-3"));
    await expect(joinButton(page)).toBeVisible();
  });

  test("a member with several cohorts logs out from the campus chooser", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.member(COHORT_3, COHORT_4));
    await page.goto("/campus");

    await logOutFromAccountMenu(page);

    await expect(page).toHaveURL("/sign-in");
    expect(await fakeApi.logoutPosts()).toHaveLength(1);
  });

  test("a member with several cohorts has no account menu in the rail", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.member(COHORT_3, COHORT_4));

    await enterCampus(page, "/campus/c-3");

    await expect(campusMap(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Account" })).toHaveCount(0);
  });

  test("a failed logout keeps the member signed in and says so", async ({
    page,
    context,
    fakeApi,
  }) => {
    await fakeApi.scriptSession(sessions.member(COHORT_3));
    await fakeApi.scriptLogout({ status: 503 });
    await enterCampus(page, "/campus/c-3");

    await logOutFromAccountMenu(page);

    await expect(page.getByText("We couldn't log you out")).toBeVisible();
    await expect(page).toHaveURL("/campus/c-3");
    expect(await cookieNamed(context, "campus_session")).toMatchObject({
      value: "session-token",
    });

    await page.reload();
    await expect(page).toHaveURL(preJoinUrl("/campus/c-3"));
    await expect(joinButton(page)).toBeVisible();
  });
});
