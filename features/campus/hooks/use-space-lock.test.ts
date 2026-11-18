import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { socialFor } from "@/core/realtime";
import {
  ADA,
  applyFrame,
  clearPresence,
  seedPresence,
} from "@/tests/fixtures/nearby-presence";
import { serverFrames } from "@/tests/fixtures/world-frames";

import { useSpaceLock } from "./use-space-lock";

const COHORT = "lock-cohort";
let unbind = () => {};

function standIn(spaceKey: string, lockedSpaces: string[] = []) {
  seedPresence(COHORT);
  act(() => {
    applyFrame(COHORT, { type: "lockableSpaces", spaceKeys: ["library"] });
    applyFrame(COHORT, {
      type: "spaceChanged",
      userId: ADA.userId,
      spaceKey,
    });
    for (const locked of lockedSpaces) {
      applyFrame(COHORT, {
        type: "lockChanged",
        spaceKey: locked,
        locked: true,
      });
    }
  });
}

function connectSocial() {
  const send = vi.fn(() => true);
  const social = socialFor(COHORT);
  unbind = social.bind(send);
  social.apply(serverFrames.welcome);
  social.apply(serverFrames.snapshot);
  return send;
}

afterEach(() => {
  unbind();
  clearPresence(COHORT);
});

describe("useSpaceLock", () => {
  it("is null outside a lockable space", () => {
    standIn("_default");

    const { result } = renderHook(() => useSpaceLock(COHORT));

    expect(result.current).toBeNull();
  });

  it("locks the lockable space the member stands in", () => {
    const send = connectSocial();
    standIn("library");
    const { result } = renderHook(() => useSpaceLock(COHORT));

    expect(result.current).toMatchObject({
      canChange: true,
      locked: false,
      spaceName: "library",
    });
    result.current!.toggle();

    expect(send).toHaveBeenCalledWith({ type: "setLock", locked: true });
  });

  it("unlocks it once world says it is locked", () => {
    const send = connectSocial();
    standIn("library", ["library"]);
    const { result } = renderHook(() => useSpaceLock(COHORT));

    result.current!.toggle();

    expect(result.current?.locked).toBe(true);
    expect(send).toHaveBeenCalledWith({ type: "setLock", locked: false });
  });

  it("follows a lock that ends on its own", () => {
    standIn("library", ["library"]);
    const { result } = renderHook(() => useSpaceLock(COHORT));

    act(() =>
      applyFrame(COHORT, {
        type: "lockChanged",
        spaceKey: "library",
        locked: false,
      }),
    );

    expect(result.current?.locked).toBe(false);
  });
});
