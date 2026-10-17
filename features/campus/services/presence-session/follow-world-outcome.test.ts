import { describe, expect, it, vi } from "vitest";

import type { RealtimeOutcome } from "@/core/realtime";

import { createCountingMediaSession } from "../../testing/presence-tab-test-utils";
import { createAdmissionStore } from "./admission-store";
import { followWorldOutcome } from "./follow-world-outcome";

const CURRENT_HREF = "https://campus.example.test/campus/c-3/meeting";

async function joinedSession() {
  const media = createCountingMediaSession();
  const admission = createAdmissionStore();
  admission.getState().grantEntry("/campus/c-3");
  admission.getState().completeEntry("/campus/c-3");
  await media.store.getState().start();
  media.store.getState().connect("c-3");
  await media.store.getState().toggleSource("camera");
  const replaceDocument = vi.fn<(href: string) => void>();
  const follow = followWorldOutcome(media.store, admission, {
    currentHref: () => CURRENT_HREF,
    replaceDocument,
  });

  return { admission, follow, media, replaceDocument };
}

describe("followWorldOutcome", () => {
  it("ends the call in place when the member opened the campus somewhere else", async () => {
    const { admission, follow, media, replaceDocument } = await joinedSession();

    follow("entered-elsewhere");

    expect(media.liveTracks()).toBe(0);
    expect(media.liveConnections()).toBe(0);
    expect(admission.getState().admitted).toBe(false);
    expect(replaceDocument).not.toHaveBeenCalled();
  });

  it("returns to the cohort picker when the member left the cohort", async () => {
    const { follow, replaceDocument } = await joinedSession();

    follow("choose-cohort");

    expect(replaceDocument).toHaveBeenCalledExactlyOnceWith("/campus");
  });

  it.each<RealtimeOutcome>(["sign-in", "onboarding", "sign-out"])(
    "reloads the page for the route guard on %s",
    async (outcome) => {
      const { follow, replaceDocument } = await joinedSession();

      follow(outcome);

      expect(replaceDocument).toHaveBeenCalledExactlyOnceWith(CURRENT_HREF);
    },
  );

  it.each<RealtimeOutcome>(["gave-up", "stop"])(
    "keeps the call and the page on %s, which the map's status shows",
    async (outcome) => {
      const { admission, follow, media, replaceDocument } =
        await joinedSession();

      follow(outcome);

      expect(media.liveTracks()).toBe(1);
      expect(admission.getState().admitted).toBe(true);
      expect(replaceDocument).not.toHaveBeenCalled();
    },
  );
});
