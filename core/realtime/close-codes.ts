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
export type PolicyViolationReason =
  | "no_token"
  | "token_not_usable"
  | "session_expired"
  | "session_ended"
  | "session_revoked"
  | "wrong_scope"
  | "account_suspended"
  | "account_gone"
  | "origin_not_allowed"
  | "no_cohort"
  | "not_a_member"
  | "rate_limited";
