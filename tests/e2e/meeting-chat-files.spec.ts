import { expect, type Page, type WebSocketRoute } from "@playwright/test";

import type { ServerMessage } from "@/core/realtime";

import { serverFrames } from "../fixtures/world-frames";
import { enterCampus } from "./support/campus-entry";
import {
  membership,
  type ScriptedReply,
  sessions,
  signIn,
  test,
} from "./support/fake-api-fixture";
import { E2E_MAP, installSanityMapStub } from "./support/sanity-stub";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);

const CAMPUS = "/campus/c-3";
const STORAGE = "https://storage.e2e.test";
const COHORT_ID = "11111111-1111-4111-8111-111111111111";
const SPACE_ID = "7c2f0a64-93d1-4a52-a5d7-0b6c9f4c2e11";
const SENT = "88888888-8888-4888-8888-888888888888";
const SENT_BY_GRACE = "99999999-9999-4999-8999-999999999999";
const ADA = serverFrames.welcome.userId;
const GRACE = { ...serverFrames.joined.player, displayName: "Grace Hopper" };

const json = (body: unknown, status = 200): ScriptedReply => ({
  status,
  body,
});

type Received = { type: string; text?: string; attachment?: unknown };

let socket: WebSocketRoute | undefined;
let said = 0;
const received: Received[] = [];

function sendFrame(frame: ServerMessage) {
  socket?.send(JSON.stringify(frame));
}

function line(
  userId: string,
  text: string,
  attachment: Received["attachment"] = null,
): ServerMessage {
  said += 1;
  return {
    type: "said",
    id: `e2e-file-line-${said}`,
    userId,
    spaceKey: "_default",
    text,
    attachment,
    at: new Date().toISOString(),
  } as ServerMessage;
}

function chatPanel(page: Page) {
  return page.getByRole("complementary", { name: "Meeting chat" });
}

// The fake media server never answers, so the audio's "couldn't connect" toast
// comes up over the panel's right edge and takes the clicks meant for it. A
// member would close it; the tests let clicks pass through it instead.
async function letClicksThroughToasts(page: Page) {
  await page.addStyleTag({
    content:
      "[data-base-ui-portal], [data-base-ui-portal] * { pointer-events: none !important; }",
  });
}

test.beforeEach(async ({ baseURL, context, fakeApi, page, world }) => {
  received.length = 0;
  socket = undefined;
  world.replaceHandler((route) => {
    socket = route;
    route.onMessage((message) => {
      const frame = JSON.parse(String(message)) as Received;
      received.push(frame);
      // World gives a line back to its speaker as well as to those near.
      if (frame.type === "say") {
        sendFrame(line(ADA, frame.text ?? "", frame.attachment ?? null));
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
    // A space with a call: its room names the campus-api space.
    route.send(
      JSON.stringify({
        type: "call",
        call: {
          url: "wss://media.e2e.test",
          room: `space:${COHORT_ID}:${SPACE_ID}`,
          token: "media-token",
          hearing: "room",
          audibleRadius: 6,
          subscribeRadius: 6,
        },
      }),
    );
  });
  await installSanityMapStub(page);
  await signIn(context, baseURL);
  await fakeApi.scriptSession(sessions.member(membership("c-3", "Cohort 3")));
  await fakeApi.scriptRoutes({
    "GET /v1/uploads/limits": json({
      maxAttachments: 10,
      kinds: [
        {
          kind: "call_chat_attachment",
          contentTypes: ["application/pdf", "image/png"],
          maxBytes: 26_214_400,
        },
      ],
    }),
    "POST /v1/uploads": json(
      {
        method: "PUT",
        mediaId: SENT,
        uploadUrl: `${STORAGE}/holding/${SENT}?signature=abc`,
        headers: {
          "Content-Type": "application/pdf",
          "x-amz-meta-kind": "call_chat_attachment",
        },
        expiresAt: "2099-01-01T00:10:00.000Z",
      },
      201,
    ),
    [`POST /v1/cohorts/c-3/spaces/${SPACE_ID}/call/attachments`]: json(
      {
        id: SENT,
        fileName: "onboarding-flow.pdf",
        contentType: "application/pdf",
        sizeBytes: 11,
        url: `${STORAGE}/read/${SENT}?signature=first`,
        urlExpiresAt: "2099-01-01T00:15:00.000Z",
      },
      201,
    ),
    [`GET /v1/media/${SENT}/url`]: json({
      id: SENT,
      fileName: "onboarding-flow.pdf",
      contentType: "application/pdf",
      sizeBytes: 11,
      url: `${STORAGE}/read/${SENT}?signature=fresh`,
      urlExpiresAt: "2099-01-01T00:30:00.000Z",
    }),
    [`GET /v1/media/${SENT_BY_GRACE}/url`]: json(
      { error: { code: "MEDIA_GONE", message: "Gone" } },
      410,
    ),
  });
  await installSanityMapStub(page);
  await enterCampus(page, CAMPUS);
  await expect.poll(() => socket !== undefined).toBe(true);
  await letClicksThroughToasts(page);
});

test("sends a file with a caption, lists it under Resources, and opens it through a fresh link", async ({
  context,
  fakeApi,
  page,
}) => {
  const stored: { headers: Record<string, string>; body: Buffer }[] = [];
  // On the context, so the tab the file opens in is answered too.
  await context.route(`${STORAGE}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "PUT") {
      stored.push({
        headers: request.headers(),
        body: request.postDataBuffer() ?? Buffer.alloc(0),
      });
    }
    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: "the file",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "PUT",
        "Access-Control-Allow-Headers": "content-type, x-amz-meta-kind",
      },
    });
  });
  await page.getByRole("button", { name: "Open chat" }).click();
  const chat = chatPanel(page);

  await chat
    .getByRole("textbox", { name: /^Message/ })
    .fill("The onboarding flow");
  await chat.getByLabel("Choose a file to send").setInputFiles({
    name: "onboarding-flow.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("hello world"),
  });

  // The card comes back from world as the member's own line.
  await expect(chat.getByText("The onboarding flow")).toBeVisible();
  await expect(
    chat.getByRole("button", { name: "Open onboarding-flow.pdf" }),
  ).toBeVisible();

  // What reached storage, signing and the call.
  expect(stored).toHaveLength(1);
  expect(stored[0]!.headers["content-type"]).toBe("application/pdf");
  expect(stored[0]!.headers["x-amz-meta-kind"]).toBe("call_chat_attachment");
  expect(stored[0]!.body.toString()).toBe("hello world");
  const signing = await fakeApi.requestsTo("POST", "/v1/uploads");
  expect(JSON.parse(signing[0]!.body)).toStrictEqual({
    kind: "call_chat_attachment",
    contentType: "application/pdf",
    sizeBytes: 11,
    fileName: "onboarding-flow.pdf",
  });
  const attached = await fakeApi.requestsTo(
    "POST",
    `/v1/cohorts/c-3/spaces/${SPACE_ID}/call/attachments`,
  );
  expect(JSON.parse(attached[0]!.body)).toStrictEqual({ mediaId: SENT });
  expect(received.find(({ type }) => type === "say")).toStrictEqual({
    type: "say",
    text: "The onboarding flow",
    attachment: {
      mediaId: SENT,
      fileName: "onboarding-flow.pdf",
      contentType: "application/pdf",
      sizeBytes: 11,
    },
  });

  await chat.getByRole("tab", { name: /Resources/ }).click();
  await expect(chat.getByRole("tab", { name: /Resources/ })).toContainText("1");
  await expect(chat.getByText("You ·")).toBeVisible();

  const popup = context.waitForEvent("page");
  await chat.getByRole("button", { name: "Open onboarding-flow.pdf" }).click();
  const tab = await popup;
  await expect.poll(() => tab.url()).toContain(`/read/${SENT}?signature=fresh`);
  expect(await fakeApi.requestsTo("GET", `/v1/media/${SENT}/url`)).toHaveLength(
    1,
  );
});

test("says a file is no longer available once the call has ended", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open chat" }).click();
  const chat = chatPanel(page);

  sendFrame(
    line(GRACE.userId, "From last time", {
      mediaId: SENT_BY_GRACE,
      fileName: "last-week.pdf",
      contentType: "application/pdf",
      sizeBytes: 2048,
    }),
  );
  await expect(chat.getByText("last-week.pdf")).toBeVisible();

  await chat.getByRole("button", { name: "Open last-week.pdf" }).click();

  const notice =
    "This file is no longer available. Files close when the call ends.";
  await expect(chat.getByText(notice)).toBeVisible();
  await expect(
    chat.getByRole("button", { name: "Open last-week.pdf" }),
  ).toHaveCount(0);
});

test("offers no file sending in the corridors", async ({ page }) => {
  sendFrame({ type: "call", call: null });
  await page.getByRole("button", { name: "Open chat" }).click();
  const chat = chatPanel(page);

  // Marked unavailable, but still pressable, so it can say why.
  await chat
    .getByRole("button", { name: "Attach a file" })
    .click({ force: true });

  await expect(
    chat.getByText("Files can be sent in meeting rooms, not in the corridors."),
  ).toBeVisible();
});
