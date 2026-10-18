// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  classifyClose,
  reconnectDelay,
  WORLD_CLOSE_REASONS,
} from "@/core/realtime";

// From world's protocol doc: WORLD_RECONNECT_GRACE_SECONDS defaults to 30.
const RECONNECT_GRACE_MS = 30_000;
const ATTEMPTS_INSIDE_GRACE = 4;
const SLOWEST_RANDOM = 1;
const LONG_REASON = "not_a_member".repeat(1000);

describe("realtime close policy eval", () => {
  it.each([
    "",
    LONG_REASON,
    "constructor",
    "__proto__",
    "toString",
    "hasOwnProperty",
    "NOT_A_MEMBER",
    " not_a_member",
    "not_a_member\u0000",
    "entered_elsewhere",
    "server shutting down",
  ])("never retries a refusal whose reason is %j", (reason) => {
    expect(classifyClose({ code: 1008, reason })).toBe("stop");
  });

  it.each([
    [1006, "not_a_member"],
    [1011, "no_token"],
    [1001, "account_gone"],
    [1009, "entered_elsewhere"],
  ])("lets the code decide when %i carries the reason %j", (code, reason) => {
    expect(classifyClose({ code, reason })).toBe("reconnect");
  });

  it.each([3000, 4499, 0])(
    "never reconnects on a close code nothing documents, even %i",
    (code) => {
      expect(classifyClose({ code, reason: "" })).toBe("stop");
    },
  );

  it.each([...WORLD_CLOSE_REASONS, "", LONG_REASON])(
    "never reconnects on 4000, even with the reason %j",
    (reason) => {
      expect(classifyClose({ code: 4000, reason })).toBe("entered-elsewhere");
    },
  );

  it("starts the first attempts in half of world's reconnect grace, leaving the rest for connecting", () => {
    let elapsedMs = 0;
    for (let attempt = 1; attempt <= ATTEMPTS_INSIDE_GRACE; attempt += 1) {
      elapsedMs += reconnectDelay(attempt, SLOWEST_RANDOM);
    }

    expect(elapsedMs).toBeLessThanOrEqual(RECONNECT_GRACE_MS / 2);
  });

  it("never retries in a tight loop and never waits past the cap", () => {
    for (let attempt = 1; attempt <= 100; attempt += 1) {
      expect(reconnectDelay(attempt, 0)).toBeGreaterThanOrEqual(500);
      expect(reconnectDelay(attempt, SLOWEST_RANDOM)).toBeLessThanOrEqual(
        16_000,
      );
    }
  });
});
