import { z } from "zod";

import {
  type FormErrors,
  type FormInvalid,
  parseForm,
} from "@/shared/lib/forms";

export const TITLE_MAX_LENGTH = 100;
export const DETAILS_MAX_LENGTH = 2000;
export const LOCATION_MAX_LENGTH = 100;
export const REPORTED_MAX_LENGTH = 80;
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
  ["bug", "idea", "report"],
  "Choose what kind of feedback this is.",
);

export const feedbackSchema = z
  .object({
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
    reported: z
      .string()
      .trim()
      .max(
        REPORTED_MAX_LENGTH,
        `Keep this under ${REPORTED_MAX_LENGTH} characters.`,
      ),
    includeDeviceInfo: z.string().transform(Boolean),
  })
  .refine(({ kind, reported }) => kind !== "report" || reported !== "", {
    path: ["reported"],
    error: "Tell us who you are reporting.",
  });

const screenshotSchema = z
  .file()
  .mime(SCREENSHOT_TYPES, `Use a ${SCREENSHOT_FORMAT_NAMES} image.`)
  .max(SCREENSHOT_MAX_BYTES, "Keep the image under 5 MB.");

type Feedback = z.output<typeof feedbackSchema>;

export type FeedbackFieldErrors = FormErrors<Feedback>;

export type FeedbackRead =
  { kind: "valid"; feedback: Feedback } | FormInvalid<Feedback>;

export function parseFeedback(form: FormData): FeedbackRead {
  const read = parseForm(feedbackSchema, form);
  return read.kind === "valid" ? { kind: "valid", feedback: read.data } : read;
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
