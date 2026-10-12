import type { FeedbackKind, NewFeedback } from "./types";

export const TITLE_MAX_LENGTH = 100;
export const DETAILS_MAX_LENGTH = 2000;
export const LOCATION_MAX_LENGTH = 100;
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;

export type FeedbackFieldErrors = Partial<
  Record<"kind" | "title" | "details" | "location", string>
>;

export type FeedbackRead =
  | { kind: "valid"; feedback: NewFeedback }
  | { kind: "invalid"; errors: FeedbackFieldErrors };

export interface FeedbackInput {
  kind: FeedbackKind | undefined;
  title: string;
  details: string;
  location: string;
  includeDeviceInfo: boolean;
}

export function parseFeedback(input: FeedbackInput): FeedbackRead {
  const title = input.title.trim();
  const details = input.details.trim();
  const location = input.location.trim();
  const errors: FeedbackFieldErrors = {};

  if (!input.kind) errors.kind = "Choose what kind of feedback this is.";
  if (!title) errors.title = "Give your feedback a short title.";
  else if (title.length > TITLE_MAX_LENGTH)
    errors.title = `Keep the title under ${TITLE_MAX_LENGTH} characters.`;
  if (details.length > DETAILS_MAX_LENGTH)
    errors.details = `Keep the details under ${DETAILS_MAX_LENGTH} characters.`;
  if (location.length > LOCATION_MAX_LENGTH)
    errors.location = `Keep this under ${LOCATION_MAX_LENGTH} characters.`;

  if (Object.keys(errors).length > 0 || !input.kind) {
    return { kind: "invalid", errors };
  }

  return {
    kind: "valid",
    feedback: {
      kind: input.kind,
      title,
      details,
      location,
      includeDeviceInfo: input.includeDeviceInfo,
    },
  };
}

export function screenshotProblem(file: File): string | undefined {
  if (!file.type.startsWith("image/")) return "Choose an image file.";
  if (file.size > SCREENSHOT_MAX_BYTES) return "Keep the image under 5 MB.";
  return undefined;
}
