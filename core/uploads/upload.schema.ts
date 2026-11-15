import { z } from "zod";

import type { SignedUpload, UploadLimits } from "./types";

const mediaKindSchema = z.enum([
  "avatar",
  "notice_attachment",
  "feedback_attachment",
]);

const uploadLimitsSchema = z.object({
  kinds: z.array(
    z.object({
      kind: z.string(),
      contentTypes: z.array(z.string()),
      maxBytes: z.number().int().positive(),
    }),
  ),
});

// A kind this client does not know yet is skipped, not a failure.
export function parseUploadLimits(body: unknown): UploadLimits[] | undefined {
  const parsed = uploadLimitsSchema.safeParse(body).data;
  return parsed?.kinds.flatMap(({ kind, contentTypes, maxBytes }) => {
    const known = mediaKindSchema.safeParse(kind).data;
    return known ? [{ kind: known, contentTypes, maxBytes }] : [];
  });
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

const tooLargeSchema = z.object({
  error: z.object({ details: z.object({ maxBytes: z.number() }) }),
});

const notAllowedSchema = z.object({
  error: z.object({ details: z.object({ allowed: z.array(z.string()) }) }),
});

export function maxBytesOf(body: unknown): number | undefined {
  return tooLargeSchema.safeParse(body).data?.error.details.maxBytes;
}

export function allowedTypesOf(body: unknown): string[] | undefined {
  return notAllowedSchema.safeParse(body).data?.error.details.allowed;
}
