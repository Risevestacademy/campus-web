import { z } from "zod";

import { type FormErrors, parseForm } from "@/shared/lib/forms";

export const TITLE_MAX_LENGTH = 100;
export const DETAILS_MAX_LENGTH = 2000;
export const LOCATION_MAX_LENGTH = 100;
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const SCREENSHOT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

export const feedbackKindSchema = z.enum(
  ["bug", "idea", "report"],
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
  // An unticked checkbox is left out of the form entirely.
  includeDeviceInfo: z.string().optional().transform(Boolean),
});

const screenshotSchema = z
  .file()
  .mime(SCREENSHOT_TYPES, "Choose an image file.")
  .max(SCREENSHOT_MAX_BYTES, "Keep the image under 5 MB.");

export type FeedbackFieldErrors = FormErrors<typeof feedbackSchema>;

export type FeedbackRead =
  | { kind: "valid"; feedback: z.output<typeof feedbackSchema> }
  | { kind: "invalid"; errors: FeedbackFieldErrors; formError?: string };

export function parseFeedback(form: FormData): FeedbackRead {
  const read = parseForm(feedbackSchema, form);
  return read.kind === "valid" ? { kind: "valid", feedback: read.data } : read;
}

export function screenshotProblem(file: File): string | undefined {
  return screenshotSchema.safeParse(file).error?.issues[0]?.message;
}
