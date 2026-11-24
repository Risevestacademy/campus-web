import { z } from "zod";

// Every `?calendar=` campus-api sends the member back with after Google. The
// list is campus-api's `CALENDAR_CONNECT_OUTCOMES`; a value outside it is
// ignored rather than shown, so the address bar cannot put words on screen.
const FAILURES = [
  "invalid_state",
  "expired_state",
  "denied",
  "missing_code",
  "exchange_failed",
  "wrong_account",
  "not_granted",
  "no_refresh_token",
  "unauthorized",
  "not_available",
  "unavailable",
  "invalid_request",
  "rate_limited",
  "server_error",
] as const;

export const connectOutcomeSchema = z.enum(["connected", ...FAILURES]);

export type ConnectOutcome = z.infer<typeof connectOutcomeSchema>;

export const CALENDAR_OUTCOME_PARAMETER = "calendar";

export function parseConnectOutcome(
  value: unknown,
): ConnectOutcome | undefined {
  const parsed = connectOutcomeSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
