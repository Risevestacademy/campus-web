import { z } from "zod";

// World names each LiveKit participant `<userId>:<anything>`.
const participantIdentitySchema = z
  .string()
  .regex(/^[^:]+:/)
  .transform((identity) => identity.slice(0, identity.indexOf(":")));

export function parseParticipantId(identity: unknown): string | undefined {
  return participantIdentitySchema.safeParse(identity).data;
}
