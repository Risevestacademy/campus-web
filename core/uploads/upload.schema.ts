import { z } from "zod";

import type { components } from "@/core/api/client";
import { type ExceptionCode, type Simplify } from "@/core/api/schemas";

import type { MediaKind, SignedUpload, UploadLimits } from "./types";

const mediaKindSchema = z.toZod<MediaKind>()(
  z.enum([
    "avatar",
    "notice_attachment",
    "feedback_attachment",
    "call_chat_attachment",
  ]),
);

const uploadKindLimitsSchema = z.toZod<UploadLimits>()(
  z.object({
    kind: mediaKindSchema,
    contentTypes: z.array(z.string()),
    maxBytes: z.number().int().positive(),
  }),
);

// A kind this client does not know yet is skipped, not a failure. Only the
// kind may be unknown: a known kind with bad limits still fails the read.
const unknownKindSchema = z
  .object({ kind: z.string() })
  .refine(({ kind }) => !mediaKindSchema.safeParse(kind).success)
  .transform(() => undefined);

const uploadLimitsSchema = z.toZod<
  Simplify<Pick<components["schemas"]["UploadLimitsDto"], "kinds">>
>()(
  z.object({
    kinds: z
      .array(z.union([uploadKindLimitsSchema, unknownKindSchema]))
      .transform((kinds) => kinds.filter((kind) => kind !== undefined)),
  }),
);

export function parseUploadLimits(body: unknown): UploadLimits[] | undefined {
  return uploadLimitsSchema.safeParse(body).data?.kinds;
}

const signedUploadSchema = z.toZod<SignedUpload>()(
  z.object({
    mediaId: z.string().min(1),
    // Storage is reached over https only; anything else is not sent the file.
    uploadUrl: z.url({ protocol: /^https$/ }),
    headers: z.record(z.string(), z.string()),
  }),
);

export function parseSignedUpload(body: unknown): SignedUpload | undefined {
  return signedUploadSchema.safeParse(body).data;
}

// The contract types an error's details only as a record, so what is bound
// here is the code: renaming UPLOAD_TOO_LARGE or UPLOAD_TYPE_NOT_ALLOWED in
// campus-api fails typecheck. The details' names come from the 413 and 415
// descriptions (`details.maxBytes`, `details.allowed`).
function uploadErrorSchema<Details extends z.ZodType>(
  code: ExceptionCode,
  details: Details,
) {
  return z.object({ error: z.object({ code: z.literal(code), details }) });
}

const tooLargeSchema = uploadErrorSchema(
  "UPLOAD_TOO_LARGE",
  z.object({ maxBytes: z.number() }),
);

const notAllowedSchema = uploadErrorSchema(
  "UPLOAD_TYPE_NOT_ALLOWED",
  z.object({ allowed: z.array(z.string()) }),
);

export function maxBytesOf(body: unknown): number | undefined {
  return tooLargeSchema.safeParse(body).data?.error.details.maxBytes;
}

export function allowedTypesOf(body: unknown): string[] | undefined {
  return notAllowedSchema.safeParse(body).data?.error.details.allowed;
}
