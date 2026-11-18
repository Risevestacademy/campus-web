import {
  type BrowserContext,
  expect,
  type Page,
  type Route,
} from "@playwright/test";

import { joinButton, preJoinUrl } from "./support/campus-entry";
import { membership, sessions, signIn, test } from "./support/fake-api-fixture";
import { installSanityMapStub } from "./support/sanity-stub";

const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL;

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);
test.skip(
  !MEDIA_URL,
  "A build without NEXT_PUBLIC_MEDIA_URL hides the connection test.",
);

const CAMPUS = "/campus/c-3";
const CONNECTION_CHECK = "**/media/connection-check";
const OFF_PIN_MEDIA_URL = "wss://evil.example.test";
const TOKEN = "eyJ.connection-check.token";
// A 1366×768 laptop leaves about this much page below the browser's toolbars.
const LAPTOP_VIEWPORT = { width: 1366, height: 650 };

type WorldReply = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

function escapeForRegExp(text: string) {
  return text.replaceAll(/[.*+?^${}()|[\]\\/]/g, String.raw`\$&`);
}

function socketsTo(origin: string) {
  return new RegExp(`^${escapeForRegExp(origin)}/`);
}

// The page calls world cross-origin with credentials, so the fulfilled
// answer needs the CORS headers world sends for an allowed origin. Without
// the expose header the browser hides Retry-After and the wait reads 60.
function fulfilFromWorld(route: Route, { status, body, headers }: WorldReply) {
  const origin = route.request().headers().origin ?? "";
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-expose-headers": "retry-after",
      "cache-control": "no-store",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function worldAnswers(context: BrowserContext, reply: WorldReply) {
  const requests: string[] = [];
  await context.route(CONNECTION_CHECK, (route) => {
    requests.push(route.request().method());
    return fulfilFromWorld(route, reply);
  });
  return requests;
}

// Holds world's answer until released, so the test sees the run in flight.
async function worldAnswersWhenReleased(
  context: BrowserContext,
  reply: WorldReply,
) {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route(CONNECTION_CHECK, async (route) => {
    await released;
    await fulfilFromWorld(route, reply);
  });
  return release;
}

// Refuses every socket to the host, so the SDK's network step fails without
// a DNS lookup. Returns the URL of every socket the page tried to open.
async function refuseMediaSockets(context: BrowserContext, origin: string) {
  const opened: string[] = [];
  await context.routeWebSocket(socketsTo(origin), async (socket) => {
    opened.push(socket.url());
    await socket.close();
  });
  return opened;
}

// Grants a token for the pinned media server, then refuses its sockets, so
// the run ends at the network step. Returns the URL of every socket opened.
async function grantUnreachableMediaServer(context: BrowserContext) {
  const media = MEDIA_URL ?? "";
  const opened = await refuseMediaSockets(context, media);
  await worldAnswers(context, {
    status: 200,
    body: {
      url: media,
      room: "connection-check-e2e",
      token: TOKEN,
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
    },
  });
  return opened;
}

function worldError(
  status: number,
  code: string,
  headers?: Record<string, string>,
): WorldReply {
  return { status, headers, body: { error: { code, message: "refused" } } };
}

async function openJoinGate(page: Page) {
  await installSanityMapStub(page);
  await page.goto(preJoinUrl(CAMPUS));
  await expect(joinButton(page)).toBeVisible();
}

function connectionTest(page: Page) {
  return page.getByRole("region", { name: "Connection test" });
}

test.beforeEach(async ({ context, baseURL, fakeApi }) => {
  await signIn(context, baseURL);
  await fakeApi.scriptSession(sessions.member(membership("c-3", "Cohort 3")));
});

test("entering the Join Gate spends none of the member's checks", async ({
  page,
  context,
}) => {
  const requests = await worldAnswers(
    context,
    worldError(503, "MEDIA_NOT_CONFIGURED"),
  );

  await openJoinGate(page);

  await expect(
    connectionTest(page).getByRole("button", { name: "Test connection" }),
  ).toBeVisible();
  expect(requests).toEqual([]);
});

test("a deployment without calls removes the test and keeps Join", async ({
  page,
  context,
}) => {
  await worldAnswers(context, worldError(503, "MEDIA_NOT_CONFIGURED"));
  await openJoinGate(page);

  await connectionTest(page)
    .getByRole("button", { name: "Test connection" })
    .click();

  await expect(connectionTest(page).getByRole("status")).toHaveText(
    "Calls aren't available on this campus yet.",
  );
  await expect(connectionTest(page).getByRole("button")).toHaveCount(0);
  await expect(joinButton(page)).toBeEnabled();
});

test("a rate limit says how long to wait", async ({ page, context }) => {
  await worldAnswers(
    context,
    worldError(429, "RATE_LIMITED", { "retry-after": "42" }),
  );
  await openJoinGate(page);

  await connectionTest(page)
    .getByRole("button", { name: "Test connection" })
    .click();

  await expect(connectionTest(page).getByRole("status")).toHaveText(
    "You've tested a few times. Try again in 42 seconds.",
  );
});

test("a session world refuses asks for a reload, not a wait", async ({
  page,
  context,
}) => {
  await worldAnswers(context, worldError(401, "UNAUTHORIZED"));
  await openJoinGate(page);

  await connectionTest(page)
    .getByRole("button", { name: "Test connection" })
    .click();

  const status = connectionTest(page).getByRole("status");
  await expect(status).toContainText("We couldn't confirm you're signed in.");
  await expect(status).toContainText("Reload the page, then test again.");
  await expect(
    connectionTest(page).getByRole("button", { name: "Test again" }),
  ).toBeEnabled();
});

test("keyboard focus stays on the test while it runs", async ({
  page,
  context,
}) => {
  const release = await worldAnswersWhenReleased(
    context,
    worldError(401, "UNAUTHORIZED"),
  );
  await openJoinGate(page);

  await connectionTest(page)
    .getByRole("button", { name: "Test connection" })
    .focus();
  await page.keyboard.press("Enter");

  const running = connectionTest(page).getByRole("button", {
    name: "Testing…",
  });
  await expect(running).toHaveAttribute("aria-disabled", "true");
  await expect(running).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(joinButton(page)).toBeFocused();
  release();
});

test("a media server the network cannot reach is named before Join", async ({
  page,
  context,
}) => {
  const opened = await grantUnreachableMediaServer(context);
  await openJoinGate(page);

  await connectionTest(page)
    .getByRole("button", { name: "Test connection" })
    .click();

  await expect(connectionTest(page).getByRole("status")).toContainText(
    "Your network is blocking calls.",
    { timeout: 30_000 },
  );
  await expect(
    connectionTest(page).getByRole("listitem").filter({ hasText: "Network" }),
  ).toHaveText("NetworkFailed");
  expect(opened.length).toBeGreaterThan(0);
  await expect(joinButton(page)).toBeEnabled();
});

test("a media server off the pinned host is never contacted", async ({
  page,
  context,
}) => {
  const opened = await refuseMediaSockets(context, OFF_PIN_MEDIA_URL);
  await worldAnswers(context, {
    status: 200,
    body: {
      url: OFF_PIN_MEDIA_URL,
      room: "connection-check-e2e",
      token: TOKEN,
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
    },
  });
  await openJoinGate(page);

  await connectionTest(page)
    .getByRole("button", { name: "Test connection" })
    .click();

  await expect(connectionTest(page).getByRole("status")).toHaveText(
    "We couldn't run the test. Try again in a moment.",
  );
  expect(opened).toEqual([]);
});

test("a laptop screen shows the whole Join Gate after a run", async ({
  page,
  context,
}) => {
  await page.setViewportSize(LAPTOP_VIEWPORT);
  await grantUnreachableMediaServer(context);
  await openJoinGate(page);

  await connectionTest(page)
    .getByRole("button", { name: "Test connection" })
    .click();
  await expect(connectionTest(page).getByRole("status")).toContainText(
    "Your network is blocking calls.",
    { timeout: 30_000 },
  );

  await page.evaluate(() => window.scrollTo(0, 0));
  const preview = await page.locator("main figure").boundingBox();
  expect(preview?.y).toBeGreaterThanOrEqual(0);
  await joinButton(page).scrollIntoViewIfNeeded();
  await expect(joinButton(page)).toBeInViewport();
});
