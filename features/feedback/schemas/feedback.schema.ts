import { z } from "zod";

import type { components } from "@/core/api/client";
import { feedbackTypeSchema, type Simplify } from "@/core/api/schemas";
import {
  type FormErrors,
  type FormInvalid,
  parseForm,
} from "@/shared/lib/forms";

export const TITLE_MAX_LENGTH = 100;
export const DETAILS_MAX_LENGTH = 2000;
export const LOCATION_MAX_LENGTH = 100;
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
const SCREENSHOT_FORMATS = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
  "image/gif": "GIF",
};
export const SCREENSHOT_TYPES = Object.keys(SCREENSHOT_FORMATS);
const SCREENSHOT_FORMAT_NAMES = new Intl.ListFormat("en-GB", {
  type: "disjunction",
}).format(Object.values(SCREENSHOT_FORMATS));

export const feedbackKindSchema = z.enum(
  feedbackTypeSchema.options,
  "Choose what kind of feedback this is.",
);

export const feedbackSchema = z.object({
  kind: feedbackKindSchema,
  title: z
    .string()
    .trim()
    .min(1, "Give your feedback a short title.")
    .max(
      TITLE_MAX_LENGTH,
      `Keep the title under ${TITLE_MAX_LENGTH} characters.`,
    ),
  details: z
    .string()
    .trim()
    .min(1, "Tell us a little more so we can look into it.")
    .max(
      DETAILS_MAX_LENGTH,
      `Keep the details under ${DETAILS_MAX_LENGTH} characters.`,
    ),
  location: z
    .string()
    .trim()
    .max(
      LOCATION_MAX_LENGTH,
      `Keep this under ${LOCATION_MAX_LENGTH} characters.`,
    ),
  // The picked person's name, kept for the history; only the id is sent.
  reported: z.string().trim(),
  reportedUserId: z.union([
    z.literal(""),
    z.uuid("Choose who you are reporting again."),
  ]),
});

const screenshotSchema = z
  .file()
  .mime(SCREENSHOT_TYPES, `Use a ${SCREENSHOT_FORMAT_NAMES} image.`)
  .max(SCREENSHOT_MAX_BYTES, "Keep the image under 5 MB.");

type Feedback = z.output<typeof feedbackSchema>;

export type FeedbackFieldErrors = FormErrors<Feedback>;

export type FeedbackRead =
  { kind: "valid"; feedback: Feedback } | FormInvalid<Feedback>;

// The picker puts a `reportedUserId` field in the form. Without one, because
// the people could not be listed, the reporter says who in the details.
export function parseFeedback(form: FormData): FeedbackRead {
  const read = parseForm(feedbackSchema, form);
  const personMissing =
    form.get("kind") === "report" &&
    form.has("reportedUserId") &&
    !form.get("reportedUserId");

  if (!personMissing) {
    return read.kind === "valid"
      ? { kind: "valid", feedback: read.data }
      : read;
  }

  const errors = read.kind === "invalid" ? read.errors : {};
  return {
    kind: "invalid",
    errors: {
      ...errors,
      reportedUserId: errors.reportedUserId ?? "Choose who you are reporting.",
    },
  };
}

// macOS lists a TIFF before the PNG of the same copy, so prefer a type we
// take; fall back to any image so its problem can be shown.
export function pickScreenshot(files: ArrayLike<File>): File | undefined {
  const images = Array.from(files).filter((file) =>
    file.type.startsWith("image/"),
  );
  return (
    images.find((image) => SCREENSHOT_TYPES.includes(image.type)) ?? images[0]
  );
}

export function screenshotProblem(file: File): string | undefined {
  return screenshotSchema.safeParse(file).error?.issues[0]?.message;
}

type FeedbackReceipt = Simplify<
  Pick<components["schemas"]["FeedbackReceiptDto"], "id">
>;

// The receipt of a send is read for its id alone; anything else is dropped.
const feedbackReceiptSchema = z.toZod<FeedbackReceipt>()(
  z.object({ id: z.string().min(1) }),
);

export function parseFeedbackReceipt(
  body: unknown,
): FeedbackReceipt | undefined {
  return feedbackReceiptSchema.safeParse(body).data;
}
