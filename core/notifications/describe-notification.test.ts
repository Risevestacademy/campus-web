import { describe, expect, it } from "vitest";

import { describeNotification } from "./describe-notification";

const context = { cohortId: "c-1", spaceKey: "library" };
const nameOf = ({ spaceKey }: typeof context) =>
  spaceKey === "library" ? "the Library" : spaceKey;

describe("describeNotification", () => {
  it.each([
    [
      "a posted notice",
      { kind: "notice_posted", context: null },
      "A new notice was posted.",
    ],
    [
      "an admitted request",
      { kind: "entry_request_admitted", context },
      "You were let into the Library.",
    ],
    [
      "a declined request",
      { kind: "entry_request_declined", context },
      "Your request to enter the Library was declined.",
    ],
    [
      "an admitted request with no space to name",
      { kind: "entry_request_admitted", context: null },
      "Your request to enter a space was admitted.",
    ],
    [
      "a declined request with no space to name",
      { kind: "entry_request_declined", context: null },
      "Your request to enter a space was declined.",
    ],
    [
      "a kind added later",
      { kind: "unknown", context: null },
      "You have a new notification.",
    ],
  ] as const)("says %s", (_, subject, text) => {
    expect(describeNotification(subject, nameOf)).toBe(text);
  });

  it("names the space as the caller does, here a raw key", () => {
    expect(
      describeNotification(
        {
          kind: "entry_request_declined",
          context: { cohortId: "c-1", spaceKey: "town_hall" },
        },
        nameOf,
      ),
    ).toBe("Your request to enter town_hall was declined.");
  });
});
