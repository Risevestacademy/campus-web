import { describe, expect, it } from "vitest";

import { createCampusWorldStore } from "./campus-world-store";

describe("createCampusWorldStore", () => {
  it("moves from idle through loading to ready", () => {
    const store = createCampusWorldStore();

    expect(store.getState()).toMatchObject({
      attempt: 0,
      errorKind: null,
      mapId: null,
      status: "idle",
    });

    const attempt = store.getState().begin();
    expect(attempt).toBe(1);
    expect(store.getState()).toMatchObject({
      attempt: 1,
      errorKind: null,
      mapId: null,
      status: "loading-map",
    });

    store.getState().ready(attempt, "campus");
    expect(store.getState()).toMatchObject({
      attempt: 1,
      errorKind: null,
      mapId: "campus",
      status: "ready",
    });
  });

  it("allows a render failure after the map became ready", () => {
    const store = createCampusWorldStore();
    const attempt = store.getState().begin();
    store.getState().ready(attempt, "campus");

    expect(
      store.getState().fail(attempt, {
        errorKind: "render",
        mapId: "campus",
      }),
    ).toBe(true);
    expect(store.getState()).toMatchObject({
      errorKind: "render",
      mapId: "campus",
      status: "failed",
    });
  });

  it("ignores a late result from an older retry attempt", () => {
    const store = createCampusWorldStore();
    const firstAttempt = store.getState().begin();
    store.getState().fail(firstAttempt, {
      errorKind: "network",
      mapId: null,
    });
    const retryAttempt = store.getState().begin();

    store.getState().ready(firstAttempt, "stale-map");
    expect(
      store.getState().fail(firstAttempt, {
        errorKind: "layout",
        mapId: "stale-map",
      }),
    ).toBe(false);

    expect(retryAttempt).toBe(2);
    expect(store.getState()).toMatchObject({
      attempt: 2,
      errorKind: null,
      mapId: null,
      status: "loading-map",
    });
  });

  it("ignores completion before an attempt begins", () => {
    const store = createCampusWorldStore();

    store.getState().ready(0, "campus");
    store.getState().fail(0, { errorKind: "manifest", mapId: null });

    expect(store.getState()).toMatchObject({
      attempt: 0,
      errorKind: null,
      mapId: null,
      status: "idle",
    });
  });
});
