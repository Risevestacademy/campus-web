import { describe, expect, it } from "vitest";

import {
  connectOutcomeSchema,
  parseConnectOutcome,
} from "./connect-outcome.schema";

describe("parseConnectOutcome", () => {
  it.each(connectOutcomeSchema.options)("reads %s", (outcome) => {
    expect(parseConnectOutcome(outcome)).toBe(outcome);
  });

  it.each([
    ["a word campus-api does not send", "hacked"],
    ["a different case", "Connected"],
    ["no value", undefined],
    ["an empty value", ""],
    ["a list", ["connected"]],
    ["markup", "<b>connected</b>"],
  ])("ignores %s", (_, value) => {
    expect(parseConnectOutcome(value)).toBeUndefined();
  });
});
