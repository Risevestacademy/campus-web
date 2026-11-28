import { z } from "zod";

// campus-api's limit, counted after the trim below.
export const FLAG_MESSAGE_MAX_LENGTH = 1000;

const EMPTY_MESSAGE = "Tell your Campus admin what's wrong.";

// Cleaned the way campus-api cleans it, so a message of spaces fails here
// rather than coming back as a 400.
const flagMessageSchema = z
  .string({ error: EMPTY_MESSAGE })
  .transform((message) => message.replaceAll("\u0000", "").trim())
  .pipe(
    z
      .string()
      .min(1, EMPTY_MESSAGE)
      .max(
        FLAG_MESSAGE_MAX_LENGTH,
        `Keep it to ${FLAG_MESSAGE_MAX_LENGTH} characters or fewer.`,
      ),
  );

export type FlagMessageRead =
  { kind: "valid"; message: string } | { kind: "invalid"; error: string };

export function parseFlagMessage(form: FormData): FlagMessageRead {
  const parsed = flagMessageSchema.safeParse(form.get("message"));
  return parsed.success
    ? { kind: "valid", message: parsed.data }
    : {
        kind: "invalid",
        error: parsed.error.issues[0]?.message ?? EMPTY_MESSAGE,
      };
}
