import { describe, expect, it } from "vitest";

import { parseFeedbackQuery } from "./feedback-query.schema";

const ITEM = "0b9a6a52-6ad8-4c1a-9f0a-2a0d6a7b8c11";

describe("parseFeedbackQuery", () => {
  it("defaults to the feedback tab and its all filter", () => {
    expect(parseFeedbackQuery({})).toEqual({
      tab: "feedback",
      filter: "all",
      page: 1,
      itemId: undefined,
    });
  });

  it("keeps a filter that belongs to the tab and drops one that doesn't", () => {
    expect(
      parseFeedbackQuery({ tab: "reports", filter: "resolved" }),
    ).toMatchObject({ tab: "reports", filter: "resolved" });
    expect(parseFeedbackQuery({ tab: "reports", filter: "bug" })).toMatchObject(
      {
        tab: "reports",
        filter: "open",
      },
    );
  });

  it("falls back on a bad tab or page", () => {
    expect(parseFeedbackQuery({ tab: "nope", page: "-3" })).toMatchObject({
      tab: "feedback",
      page: 1,
    });
  });
});

describe("parseFeedbackQuery item", () => {
  it("keeps an id and drops anything that is not one", () => {
    expect(parseFeedbackQuery({ item: ITEM }).itemId).toBe(ITEM);
    expect(parseFeedbackQuery({ item: "not-an-id" }).itemId).toBeUndefined();
    expect(
      parseFeedbackQuery({ item: "x".repeat(500) }).itemId,
    ).toBeUndefined();
  });
});
