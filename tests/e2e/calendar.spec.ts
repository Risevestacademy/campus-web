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
const SPACES = "GET /v1/spaces";
const MAKE_LINK = "POST /v1/cohorts/c-1/spaces/s-2/links";
const CALENDAR = "/campus/c-1/calendar";

const ROOM = {
  code: "k3F9xQ2pLm",
  cohortId: "c-1",
  spaceId: "s-1",
  spaceKey: "pod-a",
  spaceName: "Pod A",
  title: "Design review",
};
const connected = {
  status: 200,
  body: {
    connected: true,
    truncated: false,
    events: [
      {
        id: "e-live",
        title: "Design review",
        start: "2026-09-30T10:00:00+01:00",
        end: "2026-09-30T11:00:00+01:00",
        allDay: false,
        status: "confirmed",
        response: "accepted",
        room: ROOM,
        location: "Room 2",
        meetingUrl: "https://meet.google.com/abc-defg-hij",
        url: "https://www.google.com/calendar/event?eid=abc",
      },
      {
        id: "e-private",
        title: "Private dentist appointment",
        start: "2026-09-30T14:00:00+01:00",
        end: "2026-09-30T15:00:00+01:00",
        allDay: false,
        status: "confirmed",
        response: "accepted",
        room: null,
        location: "12 Hospital Road",
        meetingUrl: null,
        url: "https://www.google.com/calendar/event?eid=def",
      },
      {
        id: "e-other",
        title: "Other cohort secret",
        start: "2026-10-01T09:00:00+01:00",
        end: "2026-10-01T10:00:00+01:00",
        allDay: false,
        status: "confirmed",
        response: null,
        room: { ...ROOM, cohortId: "c-2", spaceName: "Their pod" },
        location: null,
        meetingUrl: null,
        url: null,
      },
    ],
  },
};
const notConnected = {
  status: 200,
  body: { connected: false, truncated: false, events: [] },
};

// Wednesday 30 September 2026, five minutes before the first event opens.
test.use({ timezoneId: "Europe/London" });

test.beforeEach(async ({ baseURL, context, fakeApi, page }) => {
  await page.clock.setFixedTime(new Date("2026-09-30T09:55:00+01:00"));
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

test("a connected member sees their week, with Busy for what has no room of this cohort", async ({
  fakeApi,
  page,
}) => {
  await fakeApi.scriptRoutes({ [EVENTS]: connected });

  await openCalendar(page);

  await expect(page.getByText(/^Connected to Google · loaded/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Design review/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Busy/ })).toHaveCount(2);
  await expect(page.getByText("Private dentist appointment")).toHaveCount(0);
  await expect(page.getByText("Hospital Road")).toHaveCount(0);
  await expect(page.getByText("Other cohort secret")).toHaveCount(0);
  await expect(page.getByText("Their pod")).toHaveCount(0);
});

test("an event with a room that is open shows LIVE, and Join walks to the room", async ({
  fakeApi,
  page,
}) => {
  await fakeApi.scriptRoutes({ [EVENTS]: connected });
  await openCalendar(page);

  await expect(page.getByText(/LIVE/).first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Join/ }).first(),
  ).toHaveAttribute("href", "/join/k3F9xQ2pLm");
});

test("an event opens its details, and a Busy one shows only a time", async ({
  fakeApi,
  page,
}) => {
  await fakeApi.scriptRoutes({ [EVENTS]: connected });
  await openCalendar(page);

  await page.getByRole("button", { name: /^Design review/ }).click();
  await expect(page.getByText("Room: Pod A")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open in Google Calendar" }),
  ).toHaveAttribute("rel", "noopener noreferrer");
  await page.keyboard.press("Escape");
  await expect(page.getByText("Room: Pod A")).toHaveCount(0);

  await page.getByRole("button", { name: /^Busy/ }).first().click();
  await expect(page.getByText("Busy · From Google")).toBeVisible();
  await expect(page.getByText("Room:")).toHaveCount(0);
});

test("the view switches between Day, Week and Month and asks for what it shows", async ({
  fakeApi,
  page,
}) => {
  await fakeApi.scriptRoutes({ [EVENTS]: connected });
  await openCalendar(page);

  await page.getByRole("button", { name: "Month", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /September 2026/, level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Design review/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Day", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Busy/ })).toHaveCount(1);

  await page.getByRole("button", { name: "Next day" }).click();
  await expect(page.getByRole("button", { name: /^Busy/ })).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /^Design review/ }),
  ).toHaveCount(0);
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
    page.getByRole("button", { name: /^Design review/ }),
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
    page.getByRole("button", { name: /^Design review/ }),
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

test("a student is not offered New room link", async ({ fakeApi, page }) => {
  await fakeApi.scriptRoutes({ [EVENTS]: connected });

  await openCalendar(page);

  await expect(page.getByText(/^Connected to Google/)).toBeVisible();
  await expect(page.getByRole("button", { name: "New room link" })).toHaveCount(
    0,
  );
});

test("an admin makes a link for any space and is told what to do with it", async ({
  fakeApi,
  page,
}) => {
  await fakeApi.scriptSession(sessions.admin(membership("c-1", "Cohort 1")));
  await fakeApi.scriptRoutes({
    [EVENTS]: connected,
    [SPACES]: {
      status: 200,
      body: {
        items: [
          { id: "s-1", name: "Pod A", kind: "classroom", isMapDefault: false },
          {
            id: "s-2",
            name: "Town Hall",
            kind: "town_hall",
            isMapDefault: false,
          },
          { id: "s-0", name: "Corridors", kind: "open", isMapDefault: true },
        ],
        meta: { page: 1, perPage: 100, total: 3, totalPages: 1 },
      },
    },
    [MAKE_LINK]: {
      status: 201,
      body: {
        audience: "cohort",
        code: "k3F9xQ2pLm",
        url: "https://campus.example/join/k3F9xQ2pLm",
        title: "All hands",
        cohortId: "c-1",
        spaceId: "s-2",
        spaceKey: "town-hall",
        spaceName: "Town Hall",
        cohortTrackId: null,
        mentorshipGroupId: null,
        startsAt: null,
      },
    },
  });
  await openCalendar(page);

  await page.getByRole("button", { name: "New room link" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Event name").fill("All hands");
  await expect(dialog.getByRole("option", { name: "Corridors" })).toHaveCount(
    0,
  );
  await dialog.getByLabel("Space").selectOption({ label: "Town Hall" });
  await dialog.getByRole("button", { name: "Make link" }).click();

  await expect(dialog.getByLabel("Link")).toHaveValue(
    "https://campus.example/join/k3F9xQ2pLm",
  );
  await expect(
    dialog.getByText(/Campus doesn.t create the event/),
  ).toBeVisible();
  const made = await fakeApi.requestsTo(
    "POST",
    "/v1/cohorts/c-1/spaces/s-2/links",
  );
  expect(made).toHaveLength(1);
});
