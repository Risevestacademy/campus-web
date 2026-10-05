import { expect, type Page } from "@playwright/test";

import { joinLink } from "./support/campus-entry";
import {
  INVITE_ID,
  invites,
  membership,
  sessions,
  signIn,
  test,
} from "./support/fake-api-fixture";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);

const TOKEN = "zHrjwba-bzFiiuyT5wb1OiuUQUdS619_DNNd0C6sFg0";
const INVITE_LINK = `/invitation?token=${TOKEN}`;
const COHORT_3 = membership("c-3", "Cohort 3");

function googleLink(page: Page) {
  return page.getByRole("link", { name: "Continue with Google" });
}

function goToCampus(page: Page) {
  return page.getByRole("button", { name: "Go to Campus" });
}

// Scoped to <main>: Next's route announcer is a live region outside it.
function notice(page: Page) {
  return page.getByRole("main").getByRole("alert");
}

test.describe("invite link", () => {
  test("previews the invitation without a session and hands off to Google", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptInvitePreview(invites.preview("Cohort 3"));

    await page.goto(INVITE_LINK);

    await expect(
      page.getByRole("heading", {
        name: "You're invited to join Backend Engineering Cohort 3",
      }),
    ).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveText([
      "Invited by • Ejemen Iboi",
      "Role • Student",
      "Cohort 3",
    ]);
    // Only a real Next build drops JSX whitespace this way; unit renders do not.
    await expect(page.getByRole("main")).toContainText(
      "This invitation gives you a Student seat in this cohort;",
    );
    await expect(googleLink(page)).toHaveAttribute(
      "href",
      "/api/v1/auth/google",
    );
    expect(await fakeApi.sessionReads()).toEqual([]);
    const posts = await fakeApi.previewPosts();
    expect(posts.map(({ body }) => JSON.parse(body))).toEqual([
      { token: TOKEN },
    ]);
  });

  test("tells the browser never to send the token on as a Referer", async ({
    page,
    fakeApi,
  }) => {
    await fakeApi.scriptInvitePreview(invites.preview());

    await page.goto(INVITE_LINK);

    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute(
      "content",
      "no-referrer",
    );
  });
});

test.describe("accepting an invitation", () => {
  test("accepts the invite shown, upgrades the session, and loads the cohort's pre-join screen", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession(sessions.provisional());
    await fakeApi.scriptDecision(
      [invites.accepted("c-3")],
      sessions.member(COHORT_3),
    );
    await page.goto("/preview");

    await goToCampus(page).click();

    await expect(page).toHaveURL("/campus/c-3/join");
    await expect(joinLink(page)).toBeVisible();
    const posts = await fakeApi.decisionPosts();
    expect(posts.map(({ body }) => JSON.parse(body))).toEqual([
      { decision: "accept", inviteId: INVITE_ID },
    ]);
    const cookies = await context.cookies();
    expect(cookies.find(({ name }) => name === "campus_session")).toMatchObject(
      { value: "full-access-session", httpOnly: true },
    );
    expect(cookies.find(({ name }) => name === "campus_refresh")).toMatchObject(
      { path: "/api/v1/auth", httpOnly: true },
    );
  });

  test("offers a fresh Google sign-in for an invite already accepted, without looping", async ({
    page,
    context,
    baseURL,
    fakeApi,
  }) => {
    await signIn(context, baseURL);
    await fakeApi.scriptSession(sessions.provisional());
    await fakeApi.scriptPendingInvite(
      invites.failure(409, "INVITE_ALREADY_ACCEPTED"),
    );

    await page.goto("/invitation");

    await expect(page).toHaveURL("/preview");
    await expect(notice(page)).toContainText(
      "You've already accepted this invitation",
    );
    await expect(googleLink(page)).toHaveAttribute(
      "href",
      "/api/v1/auth/google",
    );
    expect(await fakeApi.pendingInviteReads()).toHaveLength(1);
  });
});
