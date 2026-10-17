// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { serverFrames } from "@/tests/fixtures/world-frames";

import { createPresenceStore, presenceFor } from "./presence-store";

describe("createPresenceStore", () => {
  it("applies each message and tells subscribers", () => {
    const store = createPresenceStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.getState().apply(serverFrames.snapshot);

    expect([...store.getState().participants.keys()]).toEqual([
      serverFrames.welcome.userId,
    ]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("tells nobody about a message that changes nothing", () => {
    const store = createPresenceStore();
    store.getState().apply(serverFrames.snapshot);
    const listener = vi.fn();
    store.subscribe(listener);

    store.getState().apply(serverFrames.pong);
    store.getState().apply(serverFrames.left);

    expect(listener).not.toHaveBeenCalled();
  });

  it("forgets everyone on clear", () => {
    const store = createPresenceStore();
    store.getState().apply(serverFrames.welcome);
    store.getState().apply(serverFrames.snapshot);

    store.getState().clear();

    expect(store.getState()).toMatchObject({
      selfId: null,
      participants: new Map(),
      positions: new Map(),
    });
  });
});

describe("presenceFor", () => {
  it("keeps one store per cohort", () => {
    expect(presenceFor("cohort-a")).toBe(presenceFor("cohort-a"));
    expect(presenceFor("cohort-a")).not.toBe(presenceFor("cohort-b"));
  });
});
