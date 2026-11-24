import { describe, expect, it } from "vitest";

import { connectOutcomeSchema } from "../schemas/connect-outcome.schema";
import { noticeForOutcome } from "./connect-outcome-notice";

describe("noticeForOutcome", () => {
  it.each(connectOutcomeSchema.options)("has words for %s", (outcome) => {
    expect(noticeForOutcome(outcome).message.length).toBeGreaterThan(0);
  });

  it("says a connected calendar is a success", () => {
    expect(noticeForOutcome("connected")).toEqual({
      message: "Google Calendar connected.",
      tone: "success",
    });
  });

  it.each([
    ["denied", "You cancelled at Google, so nothing was connected."],
    [
      "wrong_account",
      "That is a different Google account. Connect the one you sign in to Campus with.",
    ],
    ["not_granted", "Calendar access was not ticked. Try again and allow it."],
    ["unauthorized", "Your session ran out. Sign in and try again."],
    ["not_available", "Google Calendar isn't switched on yet."],
    ["unavailable", "Google didn't answer. Try again in a moment."],
    ["rate_limited", "Too many tries. Wait a minute and try again."],
  ] as const)("tells the member what happened for %s", (outcome, message) => {
    expect(noticeForOutcome(outcome)).toEqual({ message, tone: "warning" });
  });

  it.each([
    "invalid_state",
    "expired_state",
    "missing_code",
    "invalid_request",
    "exchange_failed",
    "no_refresh_token",
    "server_error",
  ] as const)("gives one plain failure for %s", (outcome) => {
    expect(noticeForOutcome(outcome)).toEqual({
      message: "We couldn't connect your calendar. Try again.",
      tone: "error",
    });
  });
});
