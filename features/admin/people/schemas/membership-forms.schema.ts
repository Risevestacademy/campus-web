import { z } from "zod";

import { parseForm } from "@/shared/lib/forms";

import type {
  EndMembershipRequest,
  ExtendVisitRequest,
  MoveTrackRequest,
} from "../types/people.types";

// campus-api's limit on the reason a membership ended.
export const END_REASON_MAX_LENGTH = 500;

const reasonField = z
  .string()
  .trim()
  .max(
    END_REASON_MAX_LENGTH,
    `Keep the reason to ${END_REASON_MAX_LENGTH} characters or fewer.`,
  );

// Blank is no reason, which campus-api takes the same way.
const optionalReasonSchema = z.object({
  reason: reasonField.transform((reason) => reason || undefined),
});

// campus-api refuses a dismissal with no reason.
const requiredReasonSchema = z.object({
  reason: reasonField.min(1, "Say why they are being dismissed."),
});

export type EndMembershipFormRead =
  | { kind: "valid"; request: EndMembershipRequest }
  | { kind: "invalid"; error: string | undefined };

export function parseEndMembershipForm(
  form: FormData,
  { reasonRequired }: { reasonRequired: boolean },
): EndMembershipFormRead {
  const read = reasonRequired
    ? parseForm(requiredReasonSchema, form)
    : parseForm(optionalReasonSchema, form);
  return read.kind === "valid"
    ? { kind: "valid", request: { reason: read.data.reason } }
    : { kind: "invalid", error: read.errors.reason };
}

export type MoveTrackFormRead =
  | { kind: "valid"; request: MoveTrackRequest }
  | { kind: "invalid"; error: string | undefined };

// Only a track this cohort runs, and not the one the student is on, is
// offered; the parse keeps the form to that list.
export function parseMoveTrackForm(
  form: FormData,
  trackIds: readonly string[],
): MoveTrackFormRead {
  const schema = z.object({
    trackId: z
      .string()
      .refine((id) => trackIds.includes(id), "Choose a track."),
  });
  const read = parseForm(schema, form);
  return read.kind === "valid"
    ? { kind: "valid", request: { trackId: read.data.trackId } }
    : { kind: "invalid", error: read.errors.trackId };
}

// `datetime-local`'s value: a date and a time, with no zone.
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

export type ExtendVisitFormRead =
  | { kind: "valid"; request: ExtendVisitRequest }
  | { kind: "invalid"; error: string | undefined };

// The field is read in the browser's own zone, then sent as an instant. The
// new end must be later than both now and the end the visit already has, as
// campus-api requires.
export function parseExtendVisitForm(
  form: FormData,
  { currentEnd, now }: { currentEnd: string | null; now: number },
): ExtendVisitFormRead {
  const earliest = Math.max(now, currentEnd ? Date.parse(currentEnd) : now);
  const schema = z.object({
    accessExpiresAt: z
      .string()
      .regex(LOCAL_DATE_TIME, "Choose when the visit now ends.")
      .transform((value) => new Date(value))
      .refine(
        (end) => !Number.isNaN(end.getTime()),
        "Choose when the visit now ends.",
      )
      .refine(
        (end) => end.getTime() > earliest,
        "Choose a time later than the visit's current end.",
      ),
  });
  const read = parseForm(schema, form);
  return read.kind === "valid"
    ? {
        kind: "valid",
        request: { accessExpiresAt: read.data.accessExpiresAt.toISOString() },
      }
    : { kind: "invalid", error: read.errors.accessExpiresAt };
}
