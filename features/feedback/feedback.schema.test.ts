import { describe, expect, it } from "vitest";

import {
  parseFeedback,
  SCREENSHOT_MAX_BYTES,
  screenshotProblem,
  TITLE_MAX_LENGTH,
} from "./feedback.schema";

const valid = {
  kind: "idea",
  title: "  Show who's in a pod  ",
  details: "",
  location: "Map view",
  includeDeviceInfo: true,
} as const;

describe("parseFeedback", () => {
  it("trims the text and accepts empty details", () => {
    expect(parseFeedback(valid)).toEqual({
      kind: "valid",
      feedback: { ...valid, title: "Show who's in a pod" },
    });
  });

  it("requires a kind and a title", () => {
    expect(parseFeedback({ ...valid, kind: undefined, title: "  " })).toEqual({
      kind: "invalid",
      errors: {
        kind: "Choose what kind of feedback this is.",
        title: "Give your feedback a short title.",
      },
    });
  });

  it("rejects an over-long title", () => {
    const read = parseFeedback({
      ...valid,
      title: "x".repeat(TITLE_MAX_LENGTH + 1),
    });

    expect(read.kind).toBe("invalid");
  });
});

describe("screenshotProblem", () => {
  it("accepts a small image", () => {
    expect(
      screenshotProblem(new File(["x"], "a.png", { type: "image/png" })),
    ).toBeUndefined();
  });

  it("rejects non-images and large images", () => {
    expect(
      screenshotProblem(new File(["x"], "a.txt", { type: "text/plain" })),
    ).toBe("Choose an image file.");
    expect(
      screenshotProblem(
        new File([new Uint8Array(SCREENSHOT_MAX_BYTES + 1)], "a.png", {
          type: "image/png",
        }),
      ),
    ).toBe("Keep the image under 5 MB.");
  });
});
