import { expect } from "@playwright/test";

import { joinButton } from "./support/campus-entry";
import { membership, sessions, signIn, test } from "./support/fake-api-fixture";
import { installSanityMapStub } from "./support/sanity-stub";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);

const EVENTS = "GET /v1/calendar/events";
const DISCONNECT = "DELETE /v1/calendar";
const CALENDAR = "/campus/c-1/calendar";

const connected = {
  status: 200,
  body: {
    connected: true,
    truncated: false,
    events: [
      {
        id: "e-1",
        title: "Private dentist appointment",
        start: "2026-09-30T14:00:00+01:00",
        end: "2026-09-30T15:00:00+01:00",
        allDay: false,
        status: "confirmed",
        response: "accepted",
        room: null,
        location: "12 Hospital Road",
        meetingUrl: null,
        htmlLink: "https://www.google.com/calendar/event?eid=abc",
      },
    ],
  },
};
const notConnected = {
  status: 200,
  body: { connected: false, truncated: false, events: [] },
};

test.beforeEach(async ({ baseURL, context, fakeApi, page }) => {
  await installSanityMapStub(page);
  await signIn(context, baseURL);
  await fakeApi.scriptSession(
    sessions.invitedMember(membership("c-1", "Cohort 1")),
  );
});

async function openCalendar(page: import("@playwright/test").Page) {
  await page.goto(`/campus/c-1/join?returnTo=${encodeURIComponent(CALENDAR)}`);
  await joinButton(page).click();
  await expect(page).toHaveURL(CALENDAR);
}

test("a member who has not connected is offered Google Calendar, promising only what campus does", async ({
  fakeApi,
  page,
}) => {
  await fakeApi.scriptRoutes({ [EVENTS]: notConnected });

  await openCalendar(page);

  await expect(
    page.getByRole("heading", { name: "Connect Google Calendar" }),
  ).toBeVisible();
  await expect(
    page.getByText("Campus only reads your calendar", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Not connected to Google")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Connect Google Calendar" }).first(),
  ).toHaveAttribute("href", "/api/v1/calendar/connect");
});

test("a connected member sees it, and nothing of their events reaches the page", async ({
  fakeApi,
  page,
}) => {
  await fakeApi.scriptRoutes({ [EVENTS]: connected });

  await openCalendar(page);

  await expect(page.getByText(/^Connected to Google · loaded/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your calendar is connected" }),
  ).toBeVisible();
  await expect(page.getByText("Private dentist appointment")).toHaveCount(0);
  await expect(page.getByText("Hospital Road")).toHaveCount(0);
});

test("disconnecting asks what it does, then shows the not-connected screen", async ({
  fakeApi,
  page,
}) => {
  await fakeApi.scriptRoutes({
    [EVENTS]: connected,
    [DISCONNECT]: { status: 204 },
  });
  await openCalendar(page);

  await page.getByRole("button", { name: "Calendar settings" }).click();
  await expect(
    page.getByText(/stops campus reading your calendar/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Disconnect" }).click();

  await expect(page.getByText("Google Calendar disconnected.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Connect Google Calendar" }),
  ).toBeVisible();
  expect(await fakeApi.requestsTo("DELETE", "/v1/calendar")).toHaveLength(1);
});

test("Google not answering says so, and Retry asks again", async ({
  fakeApi,
  page,
}) => {
  await fakeApi.scriptRoutes({
    [EVENTS]: {
      status: 503,
      body: { error: { code: "SERVICE_UNAVAILABLE", message: "Google" } },
    },
  });
  await openCalendar(page);
  await expect(page.getByText("Google Calendar didn’t answer.")).toBeVisible();

  await fakeApi.scriptRoutes({ [EVENTS]: connected });
  await page.getByRole("button", { name: "Retry" }).click();

  await expect(
    page.getByRole("heading", { name: "Your calendar is connected" }),
  ).toBeVisible();
});

test("coming back from Google lands on the calendar, says how it went once and clears the address", async ({
  fakeApi,
  page,
}) => {
  await fakeApi.scriptRoutes({ [EVENTS]: connected });

  await page.goto("/campus?calendar=connected");
  await expect(page).toHaveURL(
    `/campus/c-1/join?returnTo=${encodeURIComponent(`${CALENDAR}?calendar=connected`)}`,
  );
  await joinButton(page).click();

  await expect(page).toHaveURL(CALENDAR);
  await expect(page.getByText("Google Calendar connected.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your calendar is connected" }),
  ).toBeVisible();
});

test("a cancelled connection says so and leaves the member where they were", async ({
  fakeApi,
  page,
}) => {
  await fakeApi.scriptRoutes({ [EVENTS]: notConnected });

  await page.goto("/campus?calendar=denied");
  await joinButton(page).click();

  await expect(page).toHaveURL(CALENDAR);
  await expect(
    page.getByText("You cancelled at Google, so nothing was connected."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Connect Google Calendar" }),
  ).toBeVisible();
});

test("a member with several cohorts is told how it went on the chooser, once", async ({
  fakeApi,
  page,
}) => {
  await fakeApi.scriptSession(
    sessions.member(
      membership("c-1", "Cohort 1"),
      membership("c-2", "Cohort 2"),
    ),
  );

  await page.goto("/campus?calendar=wrong_account");

  await expect(
    page.getByText(
      "That is a different Google account. Connect the one you sign in to Campus with.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Choose a cohort" }),
  ).toBeVisible();
  await expect(page).toHaveURL("/campus");
});

test("an outcome campus-api does not send is ignored", async ({
  fakeApi,
  page,
}) => {
  await fakeApi.scriptSession(
    sessions.member(
      membership("c-1", "Cohort 1"),
      membership("c-2", "Cohort 2"),
    ),
  );

  await page.goto("/campus?calendar=hacked");

  await expect(
    page.getByRole("heading", { name: "Choose a cohort" }),
  ).toBeVisible();
  await expect(page.getByText("hacked")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Notifications" }),
  ).not.toContainText(/./);
});
