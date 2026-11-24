import type { ConnectOutcome } from "../schemas/connect-outcome.schema";

export type ConnectOutcomeNotice = Readonly<{
  message: string;
  tone: "success" | "warning" | "error";
}>;

const GENERIC = {
  message: "We couldn't connect your calendar. Try again.",
  tone: "error",
} as const satisfies ConnectOutcomeNotice;

const NOTICES: Record<ConnectOutcome, ConnectOutcomeNotice> = {
  connected: { message: "Google Calendar connected.", tone: "success" },
  denied: {
    message: "You cancelled at Google, so nothing was connected.",
    tone: "warning",
  },
  wrong_account: {
    message:
      "That is a different Google account. Connect the one you sign in to Campus with.",
    tone: "warning",
  },
  not_granted: {
    message: "Calendar access was not ticked. Try again and allow it.",
    tone: "warning",
  },
  unauthorized: {
    message: "Your session ran out. Sign in and try again.",
    tone: "warning",
  },
  not_available: {
    message: "Google Calendar isn't switched on yet.",
    tone: "warning",
  },
  unavailable: {
    message: "Google didn't answer. Try again in a moment.",
    tone: "warning",
  },
  rate_limited: {
    message: "Too many tries. Wait a minute and try again.",
    tone: "warning",
  },
  invalid_state: GENERIC,
  expired_state: GENERIC,
  missing_code: GENERIC,
  invalid_request: GENERIC,
  exchange_failed: GENERIC,
  no_refresh_token: GENERIC,
  server_error: GENERIC,
};

export function noticeForOutcome(
  outcome: ConnectOutcome,
): ConnectOutcomeNotice {
  return NOTICES[outcome];
}
