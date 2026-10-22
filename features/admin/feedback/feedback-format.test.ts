import { describe, expect, it } from "vitest";

import { describeAge, personName } from "./feedback-format";
import { feedbackAdministrationHref } from "./feedback-href";

const NOW = Date.parse("2026-10-16T12:00:00.000Z");

describe("describeAge", () => {
  it.each([
    ["2026-10-16T11:59:40.000Z", "just now"],
    ["2026-10-16T11:48:00.000Z", "12 min ago"],
    ["2026-10-16T09:00:00.000Z", "3 h ago"],
    ["2026-10-13T12:00:00.000Z", "3 d ago"],
  ])("%s is %s", (createdAt, expected) => {
    expect(describeAge(createdAt, NOW)).toBe(expected);
  });
});

describe("personName", () => {
  it("falls back to the email when there is no display name", () => {
    expect(
      personName({ id: "1", email: "ada@campus.local", displayName: null }),
    ).toBe("ada@campus.local");
  });
});

describe("feedbackAdministrationHref", () => {
  it("leaves out defaults", () => {
    expect(feedbackAdministrationHref("c 1", { tab: "feedback" })).toBe(
      "/campus/c%201/feedback",
    );
    expect(
      feedbackAdministrationHref("c-1", {
        tab: "reports",
        filter: "resolved",
        page: 2,
        itemId: "x",
      }),
    ).toBe("/campus/c-1/feedback?tab=reports&filter=resolved&page=2&item=x");
  });
});
