// @vitest-environment node

import { describe, expect, it } from "vitest";

import { classifyClose, reconnectDelay } from "./close-policy";

describe("classifyClose", () => {
  it.each([
    [1008, "no_token", "sign-in"],
    [1008, "token_not_usable", "reconnect-after-refresh"],
    [1008, "session_expired", "reconnect-after-refresh"],
    [1008, "session_ended", "reconnect-after-refresh"],
    [1008, "session_revoked", "sign-in"],
    [1008, "wrong_scope", "onboarding"],
    [1008, "account_suspended", "sign-out"],
    [1008, "account_gone", "sign-out"],
    [1008, "origin_not_allowed", "stop"],
    [1008, "no_cohort", "stop"],
    [1008, "not_a_member", "choose-cohort"],
    [1008, "rate_limited", "reconnect"],
    [4000, "entered_elsewhere", "entered-elsewhere"],
    [1001, "server shutting down", "reconnect"],
    [1009, "", "reconnect"],
    [1011, "internal_error", "reconnect"],
    [1006, "", "reconnect"],
  ])("answers close %i %j with %s", (code, reason, action) => {
    expect(classifyClose({ code, reason })).toBe(action);
  });

  it("stops on a refusal reason it does not know rather than retrying it", () => {
    expect(classifyClose({ code: 1008, reason: "banned" })).toBe("stop");
  });

  it("stops on a close code it does not know", () => {
    expect(classifyClose({ code: 1012, reason: "service restart" })).toBe(
      "stop",
    );
  });
});

describe("reconnectDelay", () => {
  it.each([
    [1, 0, 500],
    [1, 0.5, 750],
    [2, 0, 1000],
    [3, 0, 2000],
    [4, 0, 4000],
    [5, 0, 8000],
    [6, 0, 8000],
    [50, 0.5, 12_000],
  ])("waits attempt %i at random %d for %i ms", (attempt, random, delayMs) => {
    expect(reconnectDelay(attempt, random)).toBe(delayMs);
  });
});
