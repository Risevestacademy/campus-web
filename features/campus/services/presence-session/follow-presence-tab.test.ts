import { describe, expect, it } from "vitest";

import {
  createCountingMediaSession,
  createTestPresenceTab,
} from "../../testing/presence-tab-test-utils";
import { createTestWorldSession } from "../../testing/world-session-test-utils";
import { createAdmissionStore } from "./admission-store";
import { followPresenceTab } from "./follow-presence-tab";

async function joinedSession() {
  const tab = createTestPresenceTab("held");
  const media = createCountingMediaSession();
  const admission = createAdmissionStore();
  admission.getState().grantEntry("/campus/c-3");
  admission.getState().completeEntry("/campus/c-3");
  await media.store.getState().start();
  media.store.getState().connect("c-3");
  await media.store.getState().toggleSource("camera");
  const world = createTestWorldSession();
  world.connect();
  followPresenceTab(tab, media.store, admission, world);

  return { admission, media, tab, world };
}

describe("followPresenceTab", () => {
  it("ends the session when another tab takes it over", async () => {
    const { admission, media, tab, world } = await joinedSession();

    tab.setStatus("taken-over");

    expect(media.liveTracks()).toBe(0);
    expect(media.liveConnections()).toBe(0);
    expect(admission.getState().admitted).toBe(false);
    expect(world.getStatus()).toEqual({ phase: "idle" });
  });

  it("releases the pre-join preview when another tab joins", async () => {
    const tab = createTestPresenceTab("vacant");
    const media = createCountingMediaSession();
    const admission = createAdmissionStore();
    admission.getState().grantEntry("/campus/c-3");
    await media.store.getState().start();
    await media.store.getState().toggleSource("camera");
    const world = createTestWorldSession({ phase: "connecting", attempt: 0 });
    followPresenceTab(tab, media.store, admission, world);

    tab.setStatus("elsewhere");

    expect(media.liveTracks()).toBe(0);
    expect(world.getStatus()).toEqual({ phase: "idle" });
    expect(admission.getState().pendingDestination).toBe("/campus/c-3");
  });

  it("restarts media with the camera off when the tab regains the cohort", async () => {
    const { media, tab } = await joinedSession();
    tab.setStatus("taken-over");

    tab.setStatus("held");
    expect(media.store.getState().camera.desiredEnabled).toBe(false);
    await media.store.getState().toggleSource("camera");

    expect(media.liveTracks()).toBe(1);
  });

  it("stops following once unsubscribed", async () => {
    const tab = createTestPresenceTab("held");
    const media = createCountingMediaSession();
    const admission = createAdmissionStore();
    await media.store.getState().start();
    await media.store.getState().toggleSource("camera");
    const stopFollowing = followPresenceTab(
      tab,
      media.store,
      admission,
      createTestWorldSession(),
    );

    stopFollowing();
    tab.setStatus("taken-over");

    expect(media.liveTracks()).toBe(1);
  });
});
