import { z } from "zod";

// World names each LiveKit participant `<userId>:<anything>`.
const participantIdentitySchema = z
  .string()
  .regex(/^[^:]+:/)
  .transform((identity) => identity.slice(0, identity.indexOf(":")));

export function parseParticipantId(identity: unknown): string | undefined {
  return participantIdentitySchema.safeParse(identity).data;
}

// World signs the member's display name into their media token; a blank or
// missing one is no name.
const participantNameSchema = z.string().trim().min(1).max(100);

export function parseParticipantName(name: unknown): string | null {
  return participantNameSchema.safeParse(name).data ?? null;
}
