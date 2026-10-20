import { describe, expect, it } from "vitest";

import {
  parseFeedback,
  parseFeedbackReceipt,
  pickScreenshot,
  SCREENSHOT_MAX_BYTES,
  screenshotProblem,
  TITLE_MAX_LENGTH,
} from "./feedback.schema";

function feedbackForm(fields: Record<string, string>) {
  const form = new FormData();
  const filled = {
    kind: "idea",
    title: "  Show who's in a pod  ",
    details: "  It happens often.  ",
    location: "Map view",
    reported: "",
    ...fields,
  };
  for (const [field, value] of Object.entries(filled)) form.set(field, value);
  return form;
}

describe("parseFeedback", () => {
  it("trims the text", () => {
    expect(parseFeedback(feedbackForm({}))).toStrictEqual({
      kind: "valid",
      feedback: {
        kind: "idea",
        title: "Show who's in a pod",
        details: "It happens often.",
        location: "Map view",
        reported: "",
      },
    });
  });

  it("requires a kind, a title and details", () => {
    expect(
      parseFeedback(feedbackForm({ kind: "", title: "  ", details: " " })),
    ).toEqual({
      kind: "invalid",
      errors: {
        kind: "Choose what kind of feedback this is.",
        title: "Give your feedback a short title.",
        details: "Tell us a little more so we can look into it.",
      },
    });
  });

  it("requires who is reported on a report only", () => {
    expect(parseFeedback(feedbackForm({ kind: "report" }))).toEqual({
      kind: "invalid",
      errors: { reported: "Tell us who you are reporting." },
    });
    expect(
      parseFeedback(feedbackForm({ kind: "report", reported: "  Ramnan  " })),
    ).toMatchObject({
      kind: "valid",
      feedback: { kind: "report", reported: "Ramnan" },
    });
    expect(parseFeedback(feedbackForm({ kind: "bug" })).kind).toBe("valid");
  });

  it("keeps who is reported short", () => {
    expect(
      parseFeedback(feedbackForm({ kind: "report", reported: "x".repeat(81) })),
    ).toEqual({
      kind: "invalid",
      errors: { reported: "Keep this under 80 characters." },
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
});

describe("parseFeedbackReceipt", () => {
  it("keeps the id and drops everything else", () => {
    expect(parseFeedbackReceipt({ id: "f1", title: "x", extra: 1 })).toEqual({
      id: "f1",
    });
  });

  it.each([null, {}, { id: "" }, { id: 4 }, "f1"])(
    "finds no receipt in %j",
    (body) => {
      expect(parseFeedbackReceipt(body)).toBeUndefined();
    },
  );
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

describe("pickScreenshot", () => {
  const tiff = new File(["x"], "pod.tiff", { type: "image/tiff" });
  const png = new File(["x"], "pod.png", { type: "image/png" });
  const text = new File(["x"], "notes.txt", { type: "text/plain" });

  it("prefers a supported image over one listed before it", () => {
    expect(pickScreenshot([tiff, png])).toBe(png);
  });

  it("falls back to an unsupported image so its problem can be shown", () => {
    expect(pickScreenshot([text, tiff])).toBe(tiff);
  });

  it.each([
    ["no files", []],
    ["no images", [text]],
  ])("picks nothing from %s", (_, files) => {
    expect(pickScreenshot(files)).toBeUndefined();
  });
});
