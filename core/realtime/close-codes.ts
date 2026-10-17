// Copied by hand: world keeps these in apps/world/src/socket/authenticate.ts
// and gateway.ts, not in protocol.schema.json, so nothing here can check them.
export const CLOSE_CODE = {
  goingAway: 1001,
  connectionLost: 1006,
  policyViolation: 1008,
  messageTooBig: 1009,
  internalError: 1011,
  enteredElsewhere: 4000,
} as const;

// Only a 1008's reason changes what the client does.
export const POLICY_VIOLATION_REASONS = [
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
] as const;

export type PolicyViolationReason = (typeof POLICY_VIOLATION_REASONS)[number];

// The client's own closes. 4000-4999 is private use, and world takes only 4000.
export const CLIENT_CLOSE = {
  invalidHandshake: { code: 4001, reason: "invalid_handshake" },
  handshakeTimeout: { code: 4002, reason: "handshake_timeout" },
  presenceEnded: { code: 1000, reason: "presence_ended" },
} as const;

// Every reason a reported close can carry: world's, then the client's own.
// close() is never reported, so presence_ended is not one of them.
export const CLOSE_REASONS = [
  ...POLICY_VIOLATION_REASONS,
  "entered_elsewhere",
  "server shutting down",
  "internal_error",
  CLIENT_CLOSE.invalidHandshake.reason,
  CLIENT_CLOSE.handshakeTimeout.reason,
] as const;

export type CloseReason = (typeof CLOSE_REASONS)[number];

export function isCloseReason(reason: string): reason is CloseReason {
  return (CLOSE_REASONS as readonly string[]).includes(reason);
}
