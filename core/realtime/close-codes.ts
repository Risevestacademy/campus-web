import type {
  CloseCode as WorldCloseCode,
  CloseReason as WorldCloseReason,
} from "./generated/world-protocol";

// World owns four codes. The browser supplies 1006 and the socket library 1009.
export const CLOSE_CODE = {
  goingAway: 1001 satisfies WorldCloseCode,
  connectionLost: 1006,
  policyViolation: 1008 satisfies WorldCloseCode,
  messageTooBig: 1009,
  internalError: 1011 satisfies WorldCloseCode,
  enteredElsewhere: 4000 satisfies WorldCloseCode,
} as const;

export const WORLD_CLOSE_CODES = [
  CLOSE_CODE.goingAway,
  CLOSE_CODE.policyViolation,
  CLOSE_CODE.internalError,
  CLOSE_CODE.enteredElsewhere,
] as const satisfies readonly WorldCloseCode[];

export const WORLD_CLOSE_REASONS = [
  "no_token",
  "token_not_usable",
  "session_expired",
  "session_ended",
  "session_revoked",
  "wrong_scope",
  "account_suspended",
  "account_gone",
  "origin_not_allowed",
  "no_cohort",
  "not_a_member",
  "rate_limited",
  "entered_elsewhere",
  "server shutting down",
  "internal_error",
] as const satisfies readonly WorldCloseReason[];

// These originate in the browser client, not world, so they are not generated.
export const CLIENT_CLOSE = {
  invalidHandshake: { code: 4001, reason: "invalid_handshake" },
  handshakeTimeout: { code: 4002, reason: "handshake_timeout" },
  livenessTimeout: { code: 4003, reason: "liveness_timeout" },
  presenceEnded: { code: 1000, reason: "presence_ended" },
} as const;

export const WORLD_CLOSE = {
  enteredElsewhere: {
    code: CLOSE_CODE.enteredElsewhere,
    reason: "entered_elsewhere" satisfies WorldCloseReason,
  },
} as const;

// close() does not report presence_ended, so analytics never accepts it.
export const CLOSE_REASONS = [
  ...WORLD_CLOSE_REASONS,
  CLIENT_CLOSE.invalidHandshake.reason,
  CLIENT_CLOSE.handshakeTimeout.reason,
  CLIENT_CLOSE.livenessTimeout.reason,
] as const;

export type CloseReason = (typeof CLOSE_REASONS)[number];

export function isCloseReason(reason: string): reason is CloseReason {
  return (CLOSE_REASONS as readonly string[]).includes(reason);
}
