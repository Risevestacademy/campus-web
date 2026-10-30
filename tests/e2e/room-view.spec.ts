import { expect, type WebSocketRoute } from "@playwright/test";

import type { Avatar, ServerMessage } from "@/core/realtime";

import { serverFrames } from "../fixtures/world-frames";
import { enterCampus } from "./support/campus-entry";
import { membership, sessions, signIn, test } from "./support/fake-api-fixture";
import { E2E_MAP, installSanityMapStub } from "./support/sanity-stub";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);

const CAMPUS_URL = "/campus/c-3";
const ADA = {
  ...serverFrames.snapshot.players[0]!,
  x: 1,
  y: 1,
  spaceKey: "library",
};
const GRACE = {
  ...serverFrames.joined.player,
  x: 2,
  y: 1,
  displayName: "Grace Hopper",
  spaceKey: "library",
} satisfies Avatar;

const ROOM_CALL: ServerMessage = {
  type: "call",
  call: {
    url: "wss://media.example.test",
    token: "media-token",
    hearing: "room",
    audibleRadius: 6,
  },
};

function sendFrame(socket: WebSocketRoute, frame: ServerMessage) {
  socket.send(JSON.stringify(frame));
}

test("titles the meeting view with the room's name and hides it once you are alone in the room", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  const sockets: WebSocketRoute[] = [];
  world.replaceHandler((socket) => {
    sockets.push(socket);
    sendFrame(socket, serverFrames.welcome);
    sendFrame(socket, {
      ...serverFrames.snapshot,
      map: E2E_MAP,
      players: [ADA, GRACE],
      spaces: [{ spaceKey: "library", name: "Library" }],
    });
    sendFrame(socket, ROOM_CALL);
  });
  await signIn(context, baseURL);
  await fakeApi.scriptSession(
    sessions.member(
      membership("c-3", "Cohort 3"),
      membership("c-4", "Cohort 4"),
    ),
  );
  await installSanityMapStub(page);
  await enterCampus(page, CAMPUS_URL);
  await expect(
    page.getByRole("region", { name: "Campus map" }),
  ).toHaveAttribute("data-status", "ready", { timeout: 15_000 });

  const heading = page.getByRole("heading", { name: "Library" });
  const graceTile = page.getByRole("button", {
    name: "Show expanded meeting view for Grace Hopper",
  });
  await expect(heading).toBeVisible();
  await expect(graceTile).toBeVisible();

  sendFrame(sockets[0]!, {
    type: "spaceChanged",
    userId: GRACE.userId,
    spaceKey: "_default",
  });

  await expect(heading).toBeHidden();
  await expect(graceTile).toBeHidden();
});
