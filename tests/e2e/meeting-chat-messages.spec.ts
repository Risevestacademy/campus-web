import { expect, type Page, type WebSocketRoute } from "@playwright/test";

import type { ServerMessage } from "@/core/realtime";

import { serverFrames } from "../fixtures/world-frames";
import { enterCampus } from "./support/campus-entry";
import { membership, sessions, signIn, test } from "./support/fake-api-fixture";
import { E2E_MAP, installSanityMapStub } from "./support/sanity-stub";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);

const CAMPUS = "/campus/c-3";
const ADA = serverFrames.welcome.userId;
const GRACE = { ...serverFrames.joined.player, displayName: "Grace Hopper" };

type Said = Extract<ServerMessage, { type: "said" }>;

let socket: WebSocketRoute | undefined;
let said = 0;
const received: Array<{ type: string; text?: string }> = [];

function sendFrame(frame: ServerMessage) {
  socket?.send(JSON.stringify(frame));
}

function line(userId: string, text: string, spaceKey = "_default"): Said {
  said += 1;
  return {
    type: "said",
    id: `e2e-line-${said}`,
    userId,
    spaceKey,
    text,
    at: new Date().toISOString(),
    attachment: null,
  } as Said;
}

function chatPanel(page: Page) {
  return page.getByRole("complementary", { name: "Meeting chat" });
}

test.beforeEach(async ({ baseURL, context, fakeApi, page, world }) => {
  received.length = 0;
  socket = undefined;
  world.replaceHandler((route) => {
    socket = route;
    route.onMessage((message) => {
      const frame = JSON.parse(String(message)) as {
        type: string;
        text?: string;
      };
      received.push(frame);
      // World gives a line back to its speaker as well as to those near.
      if (frame.type === "say" && frame.text) {
        sendFrame(line(ADA, frame.text));
      }
    });
    route.send(JSON.stringify(serverFrames.welcome));
    route.send(
      JSON.stringify({
        ...serverFrames.snapshot,
        map: E2E_MAP,
        players: [...serverFrames.snapshot.players, GRACE],
      }),
    );
  });
  await installSanityMapStub(page);
  await signIn(context, baseURL);
  await fakeApi.scriptSession(sessions.member(membership("c-3", "Cohort 3")));
  await enterCampus(page, CAMPUS);
  await expect.poll(() => socket !== undefined).toBe(true);
});

test("shows what others say and what the member says, and sends what they type", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open chat" }).click();
  const chat = chatPanel(page);
  await expect(chat.getByText("No messages yet. Say hello.")).toBeVisible();

  sendFrame(line(GRACE.userId, "Sharing my screen in a sec"));
  await expect(chat.getByText("Sharing my screen in a sec")).toBeVisible();
  await expect(
    chat.getByRole("log", { name: "Messages" }).getByText("Grace Hopper"),
  ).toBeVisible();

  const box = chat.getByRole("textbox", { name: /^Message/ });
  await box.fill("  Nice, go ahead  ");
  await box.press("Enter");

  await expect
    .poll(() => received.some(({ type }) => type === "say"))
    .toBe(true);
  expect(received.find(({ type }) => type === "say")?.text).toBe(
    "Nice, go ahead",
  );
  await expect(chat.getByText("Nice, go ahead")).toBeVisible();
  await expect(
    chat
      .getByRole("log", { name: "Messages" })
      .getByText("You", { exact: true }),
  ).toBeVisible();
  await expect(box).toHaveValue("");
});

test("counts what others say on the control bar until chat is opened", async ({
  page,
}) => {
  sendFrame(line(GRACE.userId, "One"));
  sendFrame(line(GRACE.userId, "Two"));

  await expect(
    page.getByRole("button", { name: "Open chat, 2 unread" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open chat, 2 unread" }).click();
  await expect(chatPanel(page).getByText("Two")).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(
    page.getByRole("button", { name: "Open chat", exact: true }),
  ).toBeVisible();
});

test("starts over when the member walks into another space", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open chat" }).click();
  sendFrame(line(GRACE.userId, "Said in the corridor"));
  const chat = chatPanel(page);
  await expect(chat.getByText("Said in the corridor")).toBeVisible();

  sendFrame({ type: "spaceChanged", userId: ADA, spaceKey: "library" });

  await expect(chat.getByText("Said in the corridor")).toBeHidden();
  await expect(chat.getByText("No messages yet. Say hello.")).toBeVisible();
});

test("keeps what was typed when the panel is closed and opened again", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open chat" }).click();
  const box = chatPanel(page).getByRole("textbox", { name: /^Message/ });
  await box.fill("Half a thought");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Open chat" }).click();

  await expect(
    chatPanel(page).getByRole("textbox", { name: /^Message/ }),
  ).toHaveValue("Half a thought");
});
