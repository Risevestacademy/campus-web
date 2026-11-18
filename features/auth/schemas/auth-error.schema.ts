import { z } from "zod";

const authErrorCodeSchema = z.enum([
  "account_suspended",
  "denied",
  "exchange_failed",
  "expired_state",
  "incomplete_profile",
  "invalid_request",
  "invalid_state",
  "invite_required",
  "missing_code",
  "rate_limited",
  "server_error",
  "unverified_email",
]);

type AuthErrorCode = z.output<typeof authErrorCodeSchema>;

const AUTH_ERROR_MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
  account_suspended: "This account is currently suspended.",
  denied: "Google sign-in was cancelled.",
  exchange_failed: "Google sign-in could not be completed. Please try again.",
  expired_state: "Your sign-in attempt expired. Please try again.",
  incomplete_profile: "Your Google profile is missing required information.",
  invalid_request: "The sign-in request was invalid. Please try again.",
  invalid_state:
    "Your sign-in attempt could not be verified. Please try again.",
  invite_required: "You need an invitation to access Campus.",
  missing_code: "Google did not return a sign-in code. Please try again.",
  rate_limited: "Too many sign-in attempts. Please wait and try again.",
  server_error: "Sign-in is temporarily unavailable. Please try again.",
  unverified_email: "Verify your Google email address before signing in.",
};

const UNKNOWN_AUTH_ERROR = "Sign-in could not be completed. Please try again.";

// The code arrives in the URL, so an unknown one (including "__proto__") gets
// the generic message and is never echoed.
export function authErrorMessage(code: string | undefined): string | undefined {
  if (!code) return undefined;

  const parsed = authErrorCodeSchema.safeParse(code);
  return parsed.success ? AUTH_ERROR_MESSAGES[parsed.data] : UNKNOWN_AUTH_ERROR;
}
