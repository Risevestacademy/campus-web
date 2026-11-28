import { z } from "zod";

import { parseForm } from "@/shared/lib/forms";

import type { SuspendRequest } from "../types/people.types";

// campus-api's limit on a suspension reason.
export const SUSPEND_REASON_MAX_LENGTH = 500;

const suspendFormSchema = z.toZod<{ reason: string | undefined }>()(
  z.object({
    reason: z
      .string()
      .trim()
      .max(
        SUSPEND_REASON_MAX_LENGTH,
        `Keep the reason to ${SUSPEND_REASON_MAX_LENGTH} characters or fewer.`,
      )
      // Blank is no reason, which campus-api takes the same way.
      .transform((reason) => reason || undefined),
  }),
);

export type SuspendFormRead =
  | { kind: "valid"; request: SuspendRequest }
  | { kind: "invalid"; error: string | undefined };

export function parseSuspendForm(form: FormData): SuspendFormRead {
  const read = parseForm(suspendFormSchema, form);
  return read.kind === "valid"
    ? { kind: "valid", request: { reason: read.data.reason } }
    : { kind: "invalid", error: read.errors.reason };
}
