import { z } from "zod";

// campus-api owns the token format; the cap only stops a pathological URL
// from becoming a cookie.
const INVITE_TOKEN_MAX_LENGTH = 512;

const inviteTokenSchema = z.string().trim().min(1).max(INVITE_TOKEN_MAX_LENGTH);

export function parseInviteToken(value: unknown): string | undefined {
  const parsed = inviteTokenSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
