import { CLOSE_CODE } from "./close-codes";
import type { CloseReason as WorldCloseReason } from "./generated/world-protocol";

export const CLOSE_ACTIONS = [
  "reconnect",
  "reconnect-after-refresh",
  "sign-in",
  "onboarding",
  "sign-out",
  "choose-cohort",
  "entered-elsewhere",
  "stop",
] as const;

export type CloseAction = (typeof CLOSE_ACTIONS)[number];

export interface SocketClose {
  code: number;
  reason: string;
}

const NON_POLICY_REASONS = [
  "entered_elsewhere",
  "server shutting down",
  "internal_error",
] as const satisfies readonly WorldCloseReason[];

type PolicyViolationReason = Exclude<
  WorldCloseReason,
  (typeof NON_POLICY_REASONS)[number]
>;

// A Map, not an object literal: a reason of "constructor" must not reach
// Object.prototype.
const POLICY_VIOLATION_ACTIONS = new Map<string, CloseAction>(
  Object.entries({
    no_token: "sign-in",
    token_not_usable: "reconnect-after-refresh",
    session_expired: "reconnect-after-refresh",
    session_ended: "reconnect-after-refresh",
    session_revoked: "sign-in",
    wrong_scope: "onboarding",
    account_suspended: "sign-out",
    account_gone: "sign-out",
    origin_not_allowed: "stop",
    no_cohort: "stop",
    not_a_member: "choose-cohort",
    rate_limited: "reconnect",
  } satisfies Record<PolicyViolationReason, CloseAction>),
);

const CODE_ACTIONS = new Map<number, CloseAction>([
  [CLOSE_CODE.enteredElsewhere, "entered-elsewhere"],
  [CLOSE_CODE.goingAway, "reconnect"],
  [CLOSE_CODE.messageTooBig, "reconnect"],
  [CLOSE_CODE.internalError, "reconnect"],
  [CLOSE_CODE.connectionLost, "reconnect"],
]);

// An unknown refusal stops rather than hammering a door world shut on purpose.
export function classifyClose({ code, reason }: SocketClose): CloseAction {
  if (code === CLOSE_CODE.policyViolation) {
    return POLICY_VIOLATION_ACTIONS.get(reason) ?? "stop";
  }
  return CODE_ACTIONS.get(code) ?? "reconnect";
}

const FIRST_CEILING_MS = 1000;
const MAX_CEILING_MS = 16_000;

// Equal jitter: half fixed so no retry is a tight loop, half random so a
// deploy's 1001 does not bring every tab back in the same instant.
export function reconnectDelay(attempt: number, random: number): number {
  const ceilingMs = Math.min(
    MAX_CEILING_MS,
    FIRST_CEILING_MS * 2 ** (attempt - 1),
  );
  return Math.round(ceilingMs / 2 + (ceilingMs / 2) * random);
}
