import { describe, expect, it } from "vitest";

import { createAdmissionStore } from "./admission-store";

describe("admission store", () => {
  it("starts without admission or a pending destination", () => {
    const state = createAdmissionStore().getState();

    expect(state.admitted).toBe(false);
    expect(state.pendingDestination).toBeNull();
  });

  it("admits and consumes the exact granted destination", () => {
    const store = createAdmissionStore();
    store.getState().grantEntry("/campus/c-1/overview");

    store.getState().completeEntry("/campus/c-1/overview");

    expect(store.getState().admitted).toBe(true);
    expect(store.getState().pendingDestination).toBeNull();
  });

  it("ignores a destination that does not match the grant", () => {
    const store = createAdmissionStore();
    store.getState().grantEntry("/campus/c-1");

    store.getState().completeEntry("/campus/c-1/meeting");

    expect(store.getState().admitted).toBe(false);
    expect(store.getState().pendingDestination).toBe("/campus/c-1");
  });

  it("clears Admission and any pending grant", () => {
    const store = createAdmissionStore();
    store.getState().grantEntry("/campus/c-1");
    store.getState().completeEntry("/campus/c-1");
    store.getState().grantEntry("/campus/c-1/meeting");

    store.getState().clear();

    expect(store.getState().admitted).toBe(false);
    expect(store.getState().pendingDestination).toBeNull();
  });

  it("does not admit without a grant", () => {
    const store = createAdmissionStore();

    store.getState().completeEntry("/campus/c-1");

    expect(store.getState().admitted).toBe(false);
  });
});
