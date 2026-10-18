import { CLIENT_CLOSE, CLOSE_CODE } from "./close-codes";
import type {
  CloseCode as WorldCloseCode,
  CloseReason as WorldCloseReason,
} from "./generated/world-protocol";

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

// These reasons name world's own trust policies, not a missing one: the 1008
// row falls through to the code's default rather than a reason lookup.
type NonPolicyReason = Extract<
  WorldCloseReason,
  "entered_elsewhere" | "server shutting down" | "internal_error"
>;

type PolicyViolationReason = Exclude<WorldCloseReason, NonPolicyReason>;

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

const WORLD_CODE_ACTIONS = {
  [CLOSE_CODE.goingAway]: "reconnect",
  [CLOSE_CODE.policyViolation]: "policy",
  [CLOSE_CODE.internalError]: "reconnect",
  [CLOSE_CODE.enteredElsewhere]: "entered-elsewhere",
} as const satisfies Record<WorldCloseCode, CloseAction | "policy">;

const LOCAL_CODE_ACTIONS = new Map<number, CloseAction>([
  [CLOSE_CODE.connectionLost, "reconnect"],
  [CLOSE_CODE.messageTooBig, "reconnect"],
  [CLIENT_CLOSE.invalidHandshake.code, "reconnect"],
  [CLIENT_CLOSE.handshakeTimeout.code, "reconnect"],
  [CLIENT_CLOSE.livenessTimeout.code, "reconnect"],
]);

function isWorldCloseCode(code: number): code is WorldCloseCode {
  return Object.hasOwn(WORLD_CODE_ACTIONS, code);
}

// An unknown refusal stops rather than hammering a door world shut on purpose.
export function classifyClose({ code, reason }: SocketClose): CloseAction {
  if (code === CLOSE_CODE.policyViolation) {
    return POLICY_VIOLATION_ACTIONS.get(reason) ?? "stop";
  }
  if (isWorldCloseCode(code)) {
    const action = WORLD_CODE_ACTIONS[code];
    return action === "policy" ? "stop" : action;
  }
  return LOCAL_CODE_ACTIONS.get(code) ?? "stop";
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
