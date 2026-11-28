import { describe, expect, it } from "vitest";

import {
  FLAG_MESSAGE_MAX_LENGTH,
  parseFlagMessage,
} from "./invite-flag.schema";

function form(message?: string): FormData {
  const data = new FormData();
  if (message !== undefined) data.set("message", message);
  return data;
}

describe("parseFlagMessage", () => {
  it("trims the message and drops NUL, as campus-api does", () => {
    expect(parseFlagMessage(form("  Wrong\u0000 track \n"))).toEqual({
      kind: "valid",
      message: "Wrong track",
    });
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["only spaces", "   \n "],
  ])("asks for a message when it is %s", (_, message) => {
    expect(parseFlagMessage(form(message))).toEqual({
      kind: "invalid",
      error: "Tell your Campus admin what's wrong.",
    });
  });

  it("counts the limit after trimming", () => {
    const longest = "a".repeat(FLAG_MESSAGE_MAX_LENGTH);

    expect(parseFlagMessage(form(` ${longest} `)).kind).toBe("valid");
    expect(parseFlagMessage(form(`${longest}a`))).toEqual({
      kind: "invalid",
      error: "Keep it to 1000 characters or fewer.",
    });
  });
});
