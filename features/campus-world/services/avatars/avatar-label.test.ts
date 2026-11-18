import { describe, expect, it } from "vitest";

import { escapeStyledText } from "./avatar-label";

describe("escapeStyledText", () => {
  it.each([
    ["Ada", "Ada"],
    ["[b]Ada", "\\[b]Ada"],
    ["Ada [/i]", "Ada \\[/i]"],
    ["Ada\\", "Ada\\\\"],
    ["\\[b]", "\\\\\\[b]"],
  ])("escapes %j as %j so KAPLAY draws it as written", (name, label) => {
    expect(escapeStyledText(name)).toBe(label);
  });
});
