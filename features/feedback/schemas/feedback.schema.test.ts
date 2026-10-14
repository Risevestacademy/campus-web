import { describe, expect, it } from "vitest";

import {
  parseFeedback,
  SCREENSHOT_MAX_BYTES,
  screenshotProblem,
  TITLE_MAX_LENGTH,
} from "./feedback.schema";

function feedbackForm(fields: Record<string, string>) {
  const form = new FormData();
  const filled = {
    kind: "idea",
    title: "  Show who's in a pod  ",
    details: "",
    location: "Map view",
    includeDeviceInfo: "on",
    ...fields,
  };
  for (const [field, value] of Object.entries(filled)) form.set(field, value);
  return form;
}

describe("parseFeedback", () => {
  it("trims the text and accepts empty details", () => {
    expect(parseFeedback(feedbackForm({}))).toStrictEqual({
      kind: "valid",
      feedback: {
        kind: "idea",
        title: "Show who's in a pod",
        details: "",
        location: "Map view",
        includeDeviceInfo: true,
      },
    });
  });

  it("requires a kind and a title", () => {
    expect(parseFeedback(feedbackForm({ kind: "", title: "  " }))).toEqual({
      kind: "invalid",
      errors: {
        kind: "Choose what kind of feedback this is.",
        title: "Give your feedback a short title.",
      },
    });
  });

  it("rejects an unknown kind", () => {
    expect(parseFeedback(feedbackForm({ kind: "praise" }))).toEqual({
      kind: "invalid",
      errors: { kind: "Choose what kind of feedback this is." },
    });
  });

  it("rejects an over-long title", () => {
    expect(
      parseFeedback(feedbackForm({ title: "x".repeat(TITLE_MAX_LENGTH + 1) })),
    ).toEqual({
      kind: "invalid",
      errors: { title: `Keep the title under ${TITLE_MAX_LENGTH} characters.` },
    });
  });

  it("reads an unticked device info box as false", () => {
    const form = feedbackForm({});
    form.delete("includeDeviceInfo");

    expect(parseFeedback(form)).toMatchObject({
      kind: "valid",
      feedback: { includeDeviceInfo: false },
    });
  });
});

describe("screenshotProblem", () => {
  it.each(["image/png", "image/jpeg", "image/webp", "image/gif"])(
    "accepts a small %s",
    (type) => {
      expect(screenshotProblem(new File(["x"], "a", { type }))).toBeUndefined();
    },
  );

  it.each(["text/plain", "image/svg+xml", "image/heic", "image/tiff"])(
    "rejects %s",
    (type) => {
      expect(screenshotProblem(new File(["x"], "a", { type }))).toBe(
        "Use a PNG, JPEG, WebP or GIF image.",
      );
    },
  );

  it("rejects a large image", () => {
    expect(
      screenshotProblem(
        new File([new Uint8Array(SCREENSHOT_MAX_BYTES + 1)], "a.png", {
          type: "image/png",
        }),
      ),
    ).toBe("Keep the image under 5 MB.");
  });
});
