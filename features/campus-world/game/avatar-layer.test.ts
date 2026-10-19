import type { KAPLAYOpt } from "kaplay";
import { describe, expect, it, vi } from "vitest";

import { createPresenceStore } from "@/core/presence";
import type { Avatar } from "@/core/realtime";

import { fakeKaplay } from "../testing/fake-kaplay";
import { addAvatarLayer } from "./avatar-layer";

const MAP = { height: 40, tileheight: 16, tilewidth: 16, width: 60 };
const ADA: Avatar = {
  userId: "ada",
  x: 30,
  y: 20,
  facing: "down",
  displayName: "Ada",
  spriteKey: null,
};
const GRACE: Avatar = {
  userId: "grace",
  x: 2,
  y: 3,
  facing: "left",
  displayName: "Grace",
  spriteKey: "placeholder-2",
};

function startLayer(...players: Avatar[]) {
  const fake = fakeKaplay({ autoDraw: false });
  fake.kaplay({} as KAPLAYOpt);
  const context = fake.contexts[0]!;
  const presence = createPresenceStore();
  presence.getState().apply({
    type: "snapshot",
    map: { id: "campus", version: "v1", width: 60, height: 40 },
    players,
  });

  const layer = addAvatarLayer(context.k, {
    map: MAP,
    readPresence: presence.getState,
  });

  return { context, k: context.k, layer, presence };
}

const drawnAt = (x: number, y: number) =>
  expect.objectContaining({ pos: { x, y } });

describe("addAvatarLayer", () => {
  it("draws everyone present on the avatars layer, at their tile", () => {
    const { context, k } = startLayer(ADA, GRACE);

    context.drawFrame();

    expect(k.layer).toHaveBeenCalledWith("avatars");
    expect(k.drawCircle).toHaveBeenCalledWith(drawnAt(40, 56));
    expect(k.drawCircle).toHaveBeenCalledWith(drawnAt(488, 328));
    expect(k.drawFormattedText).toHaveBeenCalledTimes(2);
  });

  it("draws from the store as it is at each frame", () => {
    const { context, k, presence } = startLayer(ADA, GRACE);

    presence.getState().apply({ type: "left", userId: "grace" });
    context.drawFrame();

    expect(k.drawCircle).toHaveBeenCalledWith(drawnAt(488, 328));
    expect(k.drawCircle).not.toHaveBeenCalledWith(drawnAt(40, 56));
  });

  it("lays out each label once, and again only when the name changes", () => {
    const { context, k, presence } = startLayer(GRACE);

    context.drawFrame();
    context.drawFrame();
    presence.getState().apply({
      type: "appearance",
      userId: "grace",
      displayName: "[b]Grace",
      spriteKey: null,
    });
    context.drawFrame();
    context.drawFrame();

    expect(
      vi.mocked(k.formatText).mock.calls.map(([options]) => options.text),
    ).toEqual(["Grace", "\\[b]Grace"]);
  });

  it("forgets a label nobody is drawn with any more", () => {
    const { context, k, presence } = startLayer(GRACE);
    const rename = (displayName: string) =>
      presence.getState().apply({
        type: "appearance",
        userId: "grace",
        displayName,
        spriteKey: null,
      });

    context.drawFrame();
    rename("G");
    context.drawFrame();
    rename("Grace");
    context.drawFrame();

    expect(k.formatText).toHaveBeenCalledTimes(3);
  });

  it("keeps the camera on you once world has placed you", () => {
    const { context, k, presence } = startLayer(ADA, GRACE);

    context.updateFrame();
    expect(k.setCamPos).not.toHaveBeenCalled();

    presence.getState().apply({
      type: "welcome",
      userId: "ada",
      connectionId: "connection-1",
      heartbeatSeconds: 30,
      stepMs: 100,
      tickMs: 50,
      displayName: "Ada",
      spriteKey: null,
    });
    context.updateFrame();

    expect(k.setCamPos).toHaveBeenLastCalledWith({ x: 488, y: 328 });
  });
});
