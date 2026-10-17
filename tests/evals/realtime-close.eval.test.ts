// @vitest-environment node

import { describe, expect, it } from "vitest";

import { classifyClose, reconnectDelay } from "@/core/realtime";

// From world's protocol doc: WORLD_RECONNECT_GRACE_SECONDS defaults to 30.
const RECONNECT_GRACE_MS = 30_000;
const ATTEMPTS_INSIDE_GRACE = 4;
const SLOWEST_RANDOM = 1;
const KNOWN_REASONS = [
  "no_token",
  "token_not_usable",
  "session_expired",
  "session_ended",
  "session_revoked",
  "wrong_scope",
  "account_suspended",
  "account_gone",
  "origin_not_allowed",
  "no_cohort",
  "not_a_member",
  "rate_limited",
  "entered_elsewhere",
  "server shutting down",
  "internal_error",
];
const KNOWN_REASON_TWICE = "not_a_member".repeat(2);

describe("realtime close policy eval", () => {
  it.each([
    "",
    KNOWN_REASON_TWICE,
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

  it.each([...KNOWN_REASONS, "", KNOWN_REASON_TWICE])(
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
