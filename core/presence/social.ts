import type { ServerMessage } from "@/core/realtime";

type Of<Type extends ServerMessage["type"]> = Extract<
  ServerMessage,
  { type: Type }
>;

// What the cohort's campus says and decides around the member: who talks,
// who knocks, what is locked, what staff did. Reducers only; presence.ts
// routes the frames here.

// World keeps no history, so neither does the client: the newest lines only.
export const CHAT_LINE_LIMIT = 200;
export const ENTRY_OUTCOME_LIMIT = 20;
export const STAFF_ACTION_LIMIT = 10;

export type ChatLine = Pick<
  Of<"said">,
  "id" | "userId" | "spaceKey" | "text" | "at"
>;
export type EntryRequest = Pick<
  Of<"entryRequested">,
  "requestId" | "userId" | "spaceKey"
>;
export type EntryOutcome = Pick<
  Of<"entryRequestEnded">,
  "requestId" | "userId" | "spaceKey" | "outcome" | "answeredBy"
>;
// `seq` numbers each action, since world gives none an id and two can look
// alike; a view tells a new one from one it has already shown by it.
export type StaffActionRecord = Pick<
  Of<"staffAction">,
  "action" | "userId" | "by" | "spaceKey" | "until" | "player"
> & { seq: number };
export type Broadcast = Of<"broadcast">["call"];

export interface Social {
  lockableSpaces: readonly string[];
  lockedSpaces: readonly string[];
  chat: readonly ChatLine[];
  // Open ones, to answer or to wait on; ended ones move to `entryOutcomes`.
  entryRequests: readonly EntryRequest[];
  entryOutcomes: readonly EntryOutcome[];
  staffActions: readonly StaffActionRecord[];
  broadcast: Broadcast;
  // Counts `desksChanged`: a change is the cue to fetch the desks again.
  desksVersion: number;
  // Counts `notification` frames: each is the cue to read the list again, the
  // record of them, which world may miss.
  notificationsVersion: number;
}

export const EMPTY_SOCIAL: Social = {
  lockableSpaces: [],
  lockedSpaces: [],
  chat: [],
  entryRequests: [],
  entryOutcomes: [],
  staffActions: [],
  broadcast: null,
  desksVersion: 0,
  notificationsVersion: 0,
};

function newest<Item>(items: readonly Item[], limit: number): readonly Item[] {
  return items.length > limit ? items.slice(items.length - limit) : items;
}

function withLock(
  locked: readonly string[],
  spaceKey: string,
  isLocked: boolean,
): readonly string[] {
  const without = locked.filter((key) => key !== spaceKey);
  return isLocked ? [...without, spaceKey] : without;
}

// A new connection's snapshot starts the locks over from world's lists.
// Requests were sent to the old socket and end with it; chat and outcomes
// are what the member has already seen, so they stay.
export function socialOfSnapshot(
  snapshot: Of<"snapshot">,
): Pick<Social, "lockableSpaces" | "lockedSpaces" | "entryRequests"> {
  return {
    lockableSpaces: snapshot.lockableSpaces ?? [],
    lockedSpaces: snapshot.lockedSpaces ?? [],
    entryRequests: [],
  };
}

// A closed socket ends every request it was sent, without a frame to say so.
export function withoutOpenRequests(): Pick<Social, "entryRequests"> {
  return { entryRequests: EMPTY_SOCIAL.entryRequests };
}

// What a frame changes in the social state, or nothing when it changes none.
export function socialChangeOf(
  social: Social,
  message: ServerMessage,
): Partial<Social> | undefined {
  switch (message.type) {
    case "lockableSpaces":
      return { lockableSpaces: message.spaceKeys };
    case "lockChanged":
      return {
        lockedSpaces: withLock(
          social.lockedSpaces,
          message.spaceKey,
          message.locked,
        ),
      };
    case "said":
      if (social.chat.some(({ id }) => id === message.id)) return undefined;
      return {
        chat: newest(
          [
            ...social.chat,
            {
              id: message.id,
              userId: message.userId,
              spaceKey: message.spaceKey,
              text: message.text,
              at: message.at,
            },
          ],
          CHAT_LINE_LIMIT,
        ),
      };
    case "entryRequested":
      if (
        social.entryRequests.some(
          ({ requestId }) => requestId === message.requestId,
        )
      ) {
        return undefined;
      }
      return {
        entryRequests: [
          ...social.entryRequests,
          {
            requestId: message.requestId,
            userId: message.userId,
            spaceKey: message.spaceKey,
          },
        ],
      };
    case "entryRequestEnded":
      return {
        entryRequests: social.entryRequests.filter(
          ({ requestId }) => requestId !== message.requestId,
        ),
        entryOutcomes: newest(
          [
            ...social.entryOutcomes,
            {
              requestId: message.requestId,
              userId: message.userId,
              spaceKey: message.spaceKey,
              outcome: message.outcome,
              answeredBy: message.answeredBy,
            },
          ],
          ENTRY_OUTCOME_LIMIT,
        ),
      };
    case "staffAction": {
      const last = social.staffActions.at(-1);
      return {
        staffActions: newest(
          [
            ...social.staffActions,
            {
              seq: (last?.seq ?? 0) + 1,
              action: message.action,
              userId: message.userId,
              by: message.by,
              spaceKey: message.spaceKey,
              until: message.until,
              player: message.player,
            },
          ],
          STAFF_ACTION_LIMIT,
        ),
      };
    }
    case "broadcast":
      return { broadcast: message.call };
    case "desksChanged":
      return { desksVersion: social.desksVersion + 1 };
    case "notification":
      return { notificationsVersion: social.notificationsVersion + 1 };
    default:
      return undefined;
  }
}
